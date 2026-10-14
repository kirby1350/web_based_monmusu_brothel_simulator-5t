// 亲自上场的步骤状态（纯函数）：迎客 → 挑逗 → 前戏 → 正戏 → 清洗
import type { OutfitId, StockingId } from './types'
import { serviceDetailLine,
  resolveService, getAvailablePlays, SERVICE_STEPS, serviceStaminaCost, serviceReward, type ServiceInput, type ServiceResult,
} from './resolve-service'
import { getPlaySlots, LIVE_SERVICE_STAMINA_LONG, LIVE_SERVICE_STAMINA_SHORT, STEP_MAX, OUTFITS, STOCKINGS } from './catalog'
import { getSatisfactionTier } from './game-engine'

export const MAIN_STEP_INDEX = 3
export const TEASE_STEP_INDEX = 1
export const OUTFIT_CHANGE_STAMINA = 5
export const LIVE_SHORT_TURNS = 4
/** 同一步每多写一回合 +2，单步仍封顶 14 */
export const EXTRA_TURN_BONUS = 2

/** 每一步的标准做法：推荐行动第一条固定是它 */
export const STEP_STANDARD_ACTION = ['上前迎接客人寒暄', '贴耳低语撩拨他', '用手细细爱抚', '开始正式侍奉', '为他清理并温存'] as const

export interface InsertedPlay { id: string; position: 'before' | 'after' }

export interface LiveState {
  stepIndex: number              // 当前步（0–4）
  turns: number[]                // 每一步写了几回合
  outfit: OutfitId
  stockings: StockingId
  outfitChanged: boolean
  plays: InsertedPlay[]
  finished: boolean              // 走完清洗后按下「下一步」
}

type Plan = Omit<ServiceInput, 'skip' | 'plays'> & { outfit: OutfitId; stockings: StockingId }

export function initLiveState(plan: Plan): LiveState {
  return { stepIndex: 0, turns: [0, 0, 0, 0, 0], outfit: plan.outfit, stockings: plan.stockings, outfitChanged: false, plays: [], finished: false }
}

export function recordTurn(s: LiveState): LiveState {
  if (s.finished) return s
  const turns = [...s.turns]
  turns[s.stepIndex] += 1
  return { ...s, turns }
}

export function nextStep(s: LiveState): LiveState {
  if (s.finished) return s
  if (s.stepIndex >= SERVICE_STEPS.length - 1) return { ...s, finished: true }
  return { ...s, stepIndex: s.stepIndex + 1 }
}

export function canChangeOutfit(s: LiveState): boolean {
  return !s.finished && s.stepIndex === TEASE_STEP_INDEX && !s.outfitChanged
}

/** 只在挑逗出现、只换一次；迎客的服装分按新衣服重算，体力额外 −5 */
export function changeOutfit(s: LiveState, outfit: OutfitId, stockings: StockingId): LiveState {
  if (!canChangeOutfit(s)) return s
  return { ...s, outfit, stockings, outfitChanged: true }
}

export function remainingPlaySlots(plan: Plan, s: LiveState): number {
  return Math.max(0, getPlaySlots(plan.roomLevel) - s.plays.length)
}

/** 可插入的 play（未插过、她会的、非正戏主类型） */
export function insertablePlays(plan: Plan, s: LiveState) {
  if (s.finished || remainingPlaySlots(plan, s) <= 0) return []
  return getAvailablePlays(plan.girl, plan.guest).filter((p) => !s.plays.some((x) => x.id === p.id))
}

/** 插入 play：正戏前（含正戏这一步）记为 before，之后记为 after */
export function insertPlay(plan: Plan, s: LiveState, playId: string): LiveState {
  if (!insertablePlays(plan, s).some((p) => p.id === playId)) return s
  return { ...s, plays: [...s.plays, { id: playId, position: s.stepIndex < MAIN_STEP_INDEX ? 'before' : 'after' }] }
}

/**
 * 单步分：0 回合（直接下一步）拿这一步公式分的一半；写 1 回合拿满公式分；
 * 每多 1 回合 +2，封顶 14。没走到的步骤记 0。
 */
export function liveStepScore(base: number, turns: number, reached: boolean): number {
  if (!reached) return 0
  if (turns <= 0) return Math.floor(base / 2)
  return Math.min(STEP_MAX, base + (turns - 1) * EXTRA_TURN_BONUS)
}

export function resolveLiveSteps(plan: Plan, s: LiveState): ServiceResult {
  const base = resolveService({ ...plan, outfit: s.outfit, stockings: s.stockings, plays: s.plays.map((p) => p.id), skip: false })
  const lastReached = s.finished ? SERVICE_STEPS.length - 1 : s.stepIndex
  const steps = base.steps.map((st, i) => ({ ...st, score: liveStepScore(st.score, s.turns[i], i <= lastReached) }))
  const standardScore = steps.reduce((a, x) => a + x.score, 0)
  const satisfaction = Math.max(0, Math.min(100, standardScore + base.playScore + base.satisfactionBonus))
  const totalTurns = s.turns.reduce((a, b) => a + b, 0)
  const tier = getSatisfactionTier(satisfaction)
  const refund = tier.payMult >= 1.3 ? base.staminaRefund : 0
  return {
    ...base,
    steps,
    standardScore,
    satisfaction,
    tier,
    memoryDetail: serviceDetailLine(plan.girl.name, plan.guest.name, {
      satisfaction, tierLabel: tier.label, outfitMatched: base.outfitMatched, plays: base.plays.map((p) => p.name), steps: steps.slice(0, lastReached + 1),
      outfitName: `${OUTFITS.find((o) => o.id === s.outfit)?.name ?? '常服'}${s.stockings !== 'none' ? '+' + (STOCKINGS.find((x) => x.id === s.stockings)?.name ?? '') : ''}`,
    }),
    reward: serviceReward(plan.guest, plan.girl, satisfaction),
    staminaCost: serviceStaminaCost(
      (totalTurns <= LIVE_SHORT_TURNS ? LIVE_SERVICE_STAMINA_SHORT : LIVE_SERVICE_STAMINA_LONG) + (s.outfitChanged ? OUTFIT_CHANGE_STAMINA : 0),
      { ...base, staminaRefund: refund }),
    affectionDelta: s.finished ? 1 : 0,
  }
}

/** 写进提示词的当前步骤说明：步骤、服装、敏感档、已插入 play；要求只写这一步 */
export function buildStepContext(opts: {
  stepLabel: string; standardAction: string; outfitName: string; zoneLabel?: string; zoneLevel?: string; plays: string[]
}): string {
  return [
    '【本场标准流程】迎客 → 挑逗 → 前戏 → 正戏 → 清洗',
    `【当前步骤】${opts.stepLabel}。这一段只写「${opts.stepLabel}」这一步，不要提前写到后面的步骤。`,
    `【这一步的标准做法】${opts.standardAction}`,
    `【当前服装】${opts.outfitName}`,
    opts.zoneLabel ? `【这一步碰到的敏感带】${opts.zoneLabel}：${opts.zoneLevel}` : '',
    opts.plays.length ? `【已插入的追加 play】${opts.plays.join('、')}` : '',
    '【推荐行动】ACTIONS 的第一条请写这一步的标准做法，后两条自由发挥。',
  ].filter(Boolean).join('\n')
}
