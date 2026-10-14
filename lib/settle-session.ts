// 接客结算写档（纯函数）：把 resolveService 的结果落进存档
import type { GameSave, Guest } from './types'
import { resolveService, type ServiceInput, type ServiceResult } from './resolve-service'
import { applyReputationDelta, calcServiceReward, MAX_ACTIONS_PER_DAY } from './game-engine'
import { LIVE_SERVICE_STAMINA_LONG, LIVE_SERVICE_STAMINA_SHORT, SKIP_SERVICE_STAMINA, MAX_STAMINA } from './catalog'

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
