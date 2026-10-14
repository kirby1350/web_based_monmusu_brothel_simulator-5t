// 接客结算写档（纯函数）：把 resolveService 的结果落进存档
import type { GameSave, Guest } from './types'
import { resolveService, type ServiceInput, type ServiceResult } from './resolve-service'
import { applyReputationDelta, calcServiceReward, getSatisfactionTier, MAX_ACTIONS_PER_DAY } from './game-engine'
import { LIVE_SERVICE_STAMINA_LONG, LIVE_SERVICE_STAMINA_SHORT, SKIP_SERVICE_STAMINA, MAX_STAMINA } from './catalog'

/** 亲自上场 4 回合以内算速战 */
export const LIVE_SHORT_TURNS = 4

/**
 * 亲自上场的结算：以跳过的公式为骨架（不吃龙娘跳过七折），按回合修正。
 * 每个玩家回合推进一步；提前结束时没走到的步骤记 0，所以可以低于跳过。
 * 额外 play 只在走到正戏（第 4 步）后才计分。
 */
export function resolveLiveService(input: Omit<ServiceInput, 'skip'>, turnCount: number): ServiceResult {
  const base = resolveService({ ...input, skip: false })
  const reached = Math.max(0, Math.min(base.steps.length, turnCount))
  const steps = base.steps.map((s, i) => (i < reached ? s : { ...s, score: 0 }))
  const plays = reached >= 4 ? base.plays : []
  const standardScore = steps.reduce((a, s) => a + s.score, 0)
  const playScore = plays.reduce((a, p) => a + p.score, 0)
  const satisfaction = Math.max(0, Math.min(100, standardScore + playScore))
  const tier = getSatisfactionTier(satisfaction)
  const sensExtra = base.staminaCost // skip=false 时只含敏感带额外消耗
  const staminaCost = (turnCount <= LIVE_SHORT_TURNS ? LIVE_SERVICE_STAMINA_SHORT : LIVE_SERVICE_STAMINA_LONG) + sensExtra
  return {
    ...base, steps, plays, standardScore, playScore, satisfaction, tier,
    reward: calcServiceReward({ ...input.guest, satisfaction }),
    staminaCost,
    affectionDelta: reached >= 5 ? 1 : 0,
  }
}

/** 预览：收入区间（亲自上场最差到最好的大致范围）与体力 */
export function previewService(input: Omit<ServiceInput, 'skip'>) {
  const skip = resolveService({ ...input, skip: true })
  const live = resolveService({ ...input, skip: false })
  const rewards = [calcServiceReward({ ...input.guest, satisfaction: 0 }), skip.reward, live.reward]
  const sensExtra = skip.staminaCost - SKIP_SERVICE_STAMINA
  return {
    skip,
    live,
    rewardRange: [Math.min(...rewards), Math.max(...rewards)] as [number, number],
    liveStamina: [LIVE_SERVICE_STAMINA_SHORT + sensExtra, LIVE_SERVICE_STAMINA_LONG + sensExtra] as [number, number],
  }
}


export interface SettleInfo {
  reward: number
  tierLabel: string
  reputationDelta: number
  becameRegular: boolean
  staminaBefore: number
  staminaAfter: number
}

/** 把一场接客写进存档：金币、体力、好感、行动、出场、客人离池、声望、回头客 */
export function applyServiceToSave(
  save: GameSave, girlId: string, guest: Guest, result: ServiceResult, rng: () => number = Math.random,
): { save: GameSave; info: SettleInfo } {
  const girl = save.girls.find((g) => g.id === girlId)
  if (!girl) throw new Error('girl not found')
  const before = girl.stamina ?? MAX_STAMINA
  const after = Math.max(0, before - result.staminaCost)
  const tier = result.tier
  const becameRegular = rng() < tier.regularChance
  let regulars = save.regulars ?? []
  if (becameRegular) {
    const existing = regulars.find((r) => r.id === guest.id)
    const regular: Guest = { ...guest, satisfaction: result.satisfaction, visits: (guest.visits ?? 0) + 1, memories: existing?.memories ?? guest.memories }
    regulars = [regular, ...regulars.filter((r) => r.id !== guest.id)].slice(0, 20)
  }
  const appeared = save.appearedToday ?? []
  return {
    info: { reward: result.reward, tierLabel: tier.label, reputationDelta: tier.reputationDelta, becameRegular, staminaBefore: before, staminaAfter: after },
    save: {
      ...save,
      player: {
        ...save.player,
        gold: save.player.gold + result.reward,
        day: save.currentDay,
        reputation: applyReputationDelta(save.player.reputation, tier.reputationDelta),
      },
      girls: save.girls.map((g) => g.id !== girlId ? g : {
        ...g,
        stamina: after,
        exhausted: after === 0 ? true : g.exhausted,
        affection: Math.min(100, g.affection + result.affectionDelta),
      }),
      actionsUsedToday: Math.min(MAX_ACTIONS_PER_DAY, (save.actionsUsedToday ?? 0) + 1),
      appearedToday: appeared.includes(girlId) ? appeared : [...appeared, girlId],
      dailyGuests: (save.dailyGuests ?? []).filter((g) => g.id !== guest.id),
      regulars,
    },
  }
}
