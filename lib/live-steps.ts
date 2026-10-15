import type { MonstGirl } from './types'
// 亲自上场的步骤状态（纯函数）：迎客 → 挑逗 → 前戏 → 正戏 → 清洗
import type { OutfitId, StockingId } from './types'
import { serviceDetailLine,
  resolveService, getAvailablePlays, SERVICE_STEPS, serviceStaminaCost, serviceReward, type ServiceInput, type ServiceResult,
} from './resolve-service'
import { getPlaySlots, LIVE_SERVICE_STAMINA_LONG, LIVE_SERVICE_STAMINA_SHORT, STEP_MAX, OUTFITS, STOCKINGS } from './catalog'
import { getSatisfactionTier } from './game-engine'
import { initHeat, heatTurn, heatAdvance, heatModelNudge, heatSatBonus, type HeatState, type HeatTurnInput } from './arousal'

export const MAIN_STEP_INDEX = 3
export const TEASE_STEP_INDEX = 1
export const OUTFIT_CHANGE_STAMINA = 5
export const LIVE_SHORT_TURNS = 4
/** 同一步每多写一回合 +2，单步仍封顶 14 */
export const EXTRA_TURN_BONUS = 2

/** 每一步的标准做法：推荐行动第一条固定是它 */
export const STEP_STANDARD_ACTION = ['上前迎接客人寒暄', '贴耳低语撩拨他', '用手细细爱抚', '开始正式侍奉', '为他清理并温存'] as const

export interface InsertedPlay { id: string; position: 'before' | 'after' }

/** 一回合的质量：对口（命中客人需求 / 这一步做法 / play / 部位关键词）、普通、敷衍（不到 6 个字） */
export type TurnKind = 'topic' | 'plain' | 'short'

export interface LiveState {
  stepIndex: number              // 当前步（0–4）
  turns: number[]                // 每一步写了几回合
  /** 每一步每回合的质量（缺省视为 plain；旧状态没有这个字段） */
  kinds?: TurnKind[][]
  /** 每一步模型 STATS 满意度折算后的贡献（已按回合、按步夹紧） */
  model?: number[]
  /** 兴奋 / 快感 */
  heat?: HeatState
  outfit: OutfitId
  stockings: StockingId
  outfitChanged: boolean
  plays: InsertedPlay[]
  finished: boolean              // 走完清洗后按下「下一步」
}

type Plan = Omit<ServiceInput, 'skip' | 'plays'> & { outfit: OutfitId; stockings: StockingId; plays?: string[]; partners?: MonstGirl[] }

/** 准备页选好的 play（含流程模板预选）在亲自上场同样算数：记为正戏前插入 */
export function initLiveState(plan: Plan): LiveState {
  const avail = new Set(getAvailablePlays(plan.girl, plan.guest).map((p) => p.id))
  const pre = (plan.plays ?? []).filter((id) => avail.has(id)).slice(0, getPlaySlots(plan.roomLevel)).map((id) => ({ id, position: 'before' as const }))
  return {
    stepIndex: 0, turns: [0, 0, 0, 0, 0], kinds: [[], [], [], [], []], model: [0, 0, 0, 0, 0],
    outfit: plan.outfit, stockings: plan.stockings, outfitChanged: false, plays: pre, finished: false,
    heat: initHeat(plan.guest, [plan.girl, ...(plan.partners ?? [])], plan.outfit, plan.stockings),
  }
}

export const SHORT_TURN_CHARS = 6
/** 每多写一回合：对口 +2、普通 +1、敷衍 0（单步仍封顶 14） */
export const EXTRA_TURN_POINTS: Record<TurnKind, number> = { topic: 2, plain: 1, short: 0 }

export function turnKind(text: string | undefined, topic: boolean): TurnKind {
  if (text !== undefined && text.replace(/\s/g, '').length < SHORT_TURN_CHARS) return 'short'
  return topic ? 'topic' : 'plain'
}

/** 玩家发一条：记回合与质量；给了 heat 输入时同时推进兴奋/快感 */
export function recordTurn(s: LiveState, opts: { text?: string; topic?: boolean; heat?: Omit<HeatTurnInput, 'stepIndex' | 'text' | 'onTopic'> } = {}): LiveState {
  if (s.finished) return s
  const turns = [...s.turns]
  turns[s.stepIndex] += 1
  const kind = opts.text === undefined && opts.topic === undefined ? 'plain' : turnKind(opts.text, !!opts.topic)
  const kinds = (s.kinds ?? [[], [], [], [], []]).map((k, i) => (i === s.stepIndex ? [...k, kind] : k))
  const heat = s.heat && opts.heat ? heatTurn(s.heat, { ...opts.heat, stepIndex: s.stepIndex, text: opts.text, onTopic: kind === 'topic' }) : s.heat
  return { ...s, turns, kinds, heat }
}

/** 模型 STATS：满意度增量按 ÷6 折算，每回合 −2~+2、每步 −3~+3、整场 −6~+8；敷衍回合不算；她的快感按 ×0.5 微调 */
export const MODEL_SAT_DIV = 6
export const MODEL_TURN_CLAMP = 2
export const MODEL_STEP_CLAMP = 3
export const MODEL_SESSION_RANGE: [number, number] = [-6, 8]
export function recordModelStats(s: LiveState, satDelta: number | undefined, girlPleasure?: { girlId: string; delta: number }): LiveState {
  let next = s
  // 敷衍回合（不到 6 个字）不吃模型的满意度
  const lastKind = (s.kinds?.[s.stepIndex] ?? []).slice(-1)[0]
  if (satDelta !== undefined && Number.isFinite(satDelta) && lastKind !== 'short') {
    const t = Math.max(-MODEL_TURN_CLAMP, Math.min(MODEL_TURN_CLAMP, Math.round(satDelta / MODEL_SAT_DIV)))
    const model = (s.model ?? [0, 0, 0, 0, 0]).map((v, i) => (i === s.stepIndex ? Math.max(-MODEL_STEP_CLAMP, Math.min(MODEL_STEP_CLAMP, v + t)) : v))
    next = { ...next, model }
  }
  if (girlPleasure && next.heat) next = { ...next, heat: heatModelNudge(next.heat, girlPleasure.girlId, girlPleasure.delta) }
  return next
}

export function nextStep(s: LiveState): LiveState {
  if (s.finished) return s
  const heat = s.heat ? heatAdvance(s.heat, s.turns[s.stepIndex] === 0) : s.heat
  if (s.stepIndex >= SERVICE_STEPS.length - 1) return { ...s, heat, finished: true }
  return { ...s, heat, stepIndex: s.stepIndex + 1 }
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

/** 按每回合质量算单步：0 回合拿一半；第 1 回合拿满公式分；之后每回合按质量加分，封顶 14 */
export function liveStepScoreByKinds(base: number, kinds: TurnKind[], reached: boolean): number {
  if (!reached) return 0
  if (!kinds.length) return Math.floor(base / 2)
  return Math.min(STEP_MAX, base + kinds.slice(1).reduce((a, k) => a + EXTRA_TURN_POINTS[k], 0))
}

/** 亲自上场的匹配加成：全额的一半起步，另一半按「有对口回合的步数 / 5」给 */
export const LIVE_MATCH_BASE = 0.5
export function liveMatchBonus(potential: number, kinds: TurnKind[][]): number {
  const topicSteps = kinds.filter((k) => k.includes('topic')).length
  return Math.round(potential * (LIVE_MATCH_BASE + (1 - LIVE_MATCH_BASE) * topicSteps / SERVICE_STEPS.length))
}

export interface LiveBreakdown { liveMatch: number; model: number; heat: number }

export function resolveLiveSteps(plan: Plan, s: LiveState): ServiceResult & { live: LiveBreakdown } {
  const base = resolveService({ ...plan, outfit: s.outfit, stockings: s.stockings, plays: s.plays.map((p) => p.id), skip: false })
  const lastReached = s.finished ? SERVICE_STEPS.length - 1 : s.stepIndex
  const kinds = s.kinds ?? s.turns.map((n) => Array.from({ length: n }, () => 'plain' as TurnKind))
  const steps = base.steps.map((st, i) => ({ ...st, score: liveStepScoreByKinds(st.score, (kinds[i] ?? []).slice(0, s.turns[i]).concat(Array.from({ length: Math.max(0, s.turns[i] - (kinds[i]?.length ?? 0)) }, () => 'plain' as TurnKind)), i <= lastReached) }))
  const standardScore = steps.reduce((a, x) => a + x.score, 0)
  const liveMatch = liveMatchBonus(base.matchPotential, kinds)
  const model = Math.max(MODEL_SESSION_RANGE[0], Math.min(MODEL_SESSION_RANGE[1], (s.model ?? []).reduce((a, b) => a + b, 0)))
  const heat = heatSatBonus(s.heat)
  const satisfaction = Math.max(0, Math.min(100, standardScore + base.playScore + base.satisfactionBonus + liveMatch + model + heat))
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
    live: { liveMatch, model, heat },
  }
}

// ─── 对口判定（本地关键词）：客人需求 / 这一步做法 / 已选 play / 部位 / 主类型 ─────

const STEP_WORDS: string[][] = [
  ['迎', '招呼', '寒暄', '茶', '奶', '坐', '外套', '欢迎', '笑'],
  ['耳', '低语', '撩', '吹气', '调情', '挑逗', '尾巴', '贴', '蹭'],
  ['抚', '摸', '揉', '吻', '舔', '手', '指', '爱抚'],
  [],
  ['擦', '洗', '清理', '温存', '抱', '休息', '毛巾', '依偎'],
]
const MAIN_WORDS: Record<string, string[]> = {
  口侍: ['口', '舔', '含', '吞', '舌', '嘴', '深喉'], 胸侍: ['胸', '乳', '夹', '奶'], 身侍: ['插', '腰', '骑', '穴', '顶', '后入', '体位'],
}
const STOP_BIGRAMS = new Set(['客人', '一下', '她的', '他的', '我们', '你的', '然后', '慢慢', '一点', '想要', '想把', '彻底', '魔物'])
const bigrams = (t: string) => { const c = t.replace(/[^\u4e00-\u9fff]/g, ''); const out: string[] = []; for (let i = 0; i + 1 < c.length; i++) { const b = c.slice(i, i + 2); if (!STOP_BIGRAMS.has(b)) out.push(b) } return out }

export interface TopicContext { desires: string; desireDetail?: string; stepIndex: number; stepAction?: string; playNames?: string[]; zone?: string; mainSkill?: string; prefOutfit?: string }
export function topicKeywords(c: TopicContext): string[] {
  const words = new Set<string>([...(STEP_WORDS[c.stepIndex] ?? []), ...bigrams(`${c.desires}${c.desireDetail ?? ''}`), ...bigrams(c.stepAction ?? ''), ...(c.playNames ?? []), ...(c.playNames ?? []).flatMap(bigrams)])
  if (c.zone) words.add(c.zone.slice(0, 2))
  if (c.prefOutfit) words.add(c.prefOutfit)
  if (c.stepIndex === 3 && c.mainSkill) for (const w of MAIN_WORDS[c.mainSkill] ?? []) words.add(w)
  return [...words].filter(Boolean)
}
export function topicHit(text: string, c: TopicContext): boolean {
  return topicKeywords(c).some((w) => text.includes(w))
}

/** 写进提示词的当前步骤说明：步骤、服装、敏感档、已插入 play；要求只写这一步 */
/** 每一步的强度上限（按五步的实际结构）：前三步不插入，清洗不再开新的激烈玩法 */
export const STEP_INTENSITY: string[] = [
  '迎客：只到寒暄、挽手、贴近、轻吻手背或脸颊，可以有视线与暗示；不脱衣、不碰性器、不插入',
  '挑逗：耳语、接吻、隔着衣物的抚摸与磨蹭、衣物半褪；不直接碰性器，不插入',
  '前戏：手、唇舌、胸、腿的直接爱抚与侍奉都可以（手、口、乳的侍奉在这一步）；不插入小穴或后庭',
  '正戏：按客人的主需求与插入的 play 尽情展开，插入、体位、节奏不设上限；高潮仍只按档位',
  '清洗：不再开新的激烈玩法；清理、拥抱、轻吻与余韵为主，节奏放慢',
]

export function buildStepContext(opts: {
  stepLabel: string; standardAction: string; outfitName: string; zoneLabel?: string; zoneLevel?: string; plays: string[]
  /** 给出时附上这一步的强度上限 */
  stepIndex?: number
}): string {
  return [
    '【本场标准流程】迎客 → 挑逗 → 前戏 → 正戏 → 清洗',
    `【当前步骤】${opts.stepLabel}。这一段只写「${opts.stepLabel}」这一步，不要提前写到后面的步骤；但要把这一步写足写细（放慢节奏，写动作、对白、反应的来回），篇幅照常。`,
    `【这一步的标准做法】${opts.standardAction}`,
    opts.stepIndex !== undefined && STEP_INTENSITY[opts.stepIndex] ? `【这一步的强度上限（必须遵守，挂在这一步的 play 也按这个上限的方式来做）】${STEP_INTENSITY[opts.stepIndex]}` : '',
    `【当前服装】${opts.outfitName}`,
    opts.zoneLabel ? `【这一步碰到的敏感带】${opts.zoneLabel}：${opts.zoneLevel}` : '',
    opts.plays.length ? `【已插入的追加 play】${opts.plays.join('、')}` : '',
    '【推荐行动】ACTIONS 的第一条请写这一步的标准做法，后两条自由发挥。',
  ].filter(Boolean).join('\n')
}
