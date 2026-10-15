import { logService, currentDayLog } from './day-summary'
import { serviceFailIncident } from './incidents'
// 接客结算写档（纯函数）：把 resolveService 的结果落进存档
import type { GameSave, Guest } from './types'
import { resolveService, serviceStaminaCost, type ServiceInput, type ServiceResult } from './resolve-service'
import type { TrainingResult } from './resolve-training'
import { applyReputationDelta, calcServiceReward, MAX_ACTIONS_PER_DAY } from './game-engine'
import { LIVE_SERVICE_STAMINA_LONG, LIVE_SERVICE_STAMINA_SHORT, MAX_STAMINA } from './catalog'
import { sceneRiskIncident } from './scenes'
import { recordService, recordTraining } from './girl-memory'
import { growProficiency, SERVICE_PROF_CAP, type ProfChange } from './proficiency'

/** 预览：收入区间（亲自上场最差到最好的大致范围）与体力 */
export function previewService(input: Omit<ServiceInput, 'skip'>) {
  const skip = resolveService({ ...input, skip: true })
  const live = resolveService({ ...input, skip: false })
  const rewards = [calcServiceReward({ ...input.guest, satisfaction: 0 }), skip.reward, live.reward]
  return {
    skip,
    live,
    rewardRange: [Math.min(...rewards), Math.max(...rewards)] as [number, number],
    liveStamina: [serviceStaminaCost(LIVE_SERVICE_STAMINA_SHORT, { ...live, staminaRefund: 0 }), serviceStaminaCost(LIVE_SERVICE_STAMINA_LONG, { ...live, staminaRefund: 0 })] as [number, number],
  }
}


export interface SettleInfo {
  /** 本场「不满」后新记的接客失败事件 */
  incident?: import('./types').Incident
  reward: number
  tierLabel: string
  /** 熟练度实际变化 */
  profChanges?: ProfChange[]
  becameTwoSided?: boolean
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
  const incident = serviceFailIncident(girl, guest, tier.key, save.currentDay, rng)
  const grown = growProficiency(girl, result.profGains ?? {}, SERVICE_PROF_CAP)
  const logged = logService(save, { girl: girl.name, guest: guest.name, tier: tier.label, sat: result.satisfaction, pay: result.reward, regular: becameRegular, rep: applyReputationDelta(save.player.reputation, tier.reputationDelta) - (save.player.reputation ?? 0) })
  return {
    info: { profChanges: grown.changes, becameTwoSided: grown.becameTwoSided, incident: incident ?? undefined, reward: result.reward, tierLabel: tier.label, reputationDelta: tier.reputationDelta, becameRegular, staminaBefore: before, staminaAfter: after },
    save: {
      ...logged,
      player: {
        ...save.player,
        gold: save.player.gold + result.reward,
        day: save.currentDay,
        reputation: applyReputationDelta(save.player.reputation, tier.reputationDelta),
      },
      girls: save.girls.map((g) => g.id !== girlId ? g : {
        ...recordService(g, guest, { tier: tier.label, sat: result.satisfaction, reward: result.reward }, save.currentDay),
        proficiency: grown.girl.proficiency,
        inclination: grown.girl.inclination,
        stamina: after,
        exhausted: after === 0 ? true : g.exhausted,
        affection: Math.min(100, g.affection + result.affectionDelta),
        ...(incident ? { incident } : {}),
      }),
      actionsUsedToday: Math.min(MAX_ACTIONS_PER_DAY, (save.actionsUsedToday ?? 0) + 1),
      appearedToday: appeared.includes(girlId) ? appeared : [...appeared, girlId],
      dailyGuests: (save.dailyGuests ?? []).filter((g) => g.id !== guest.id),
      regulars,
    },
  }
}

/**
 * 把一场调教写进存档：魔物娘数值/三围/敏感带/体力、塑形药出背包、行动 +1、已出场；金币不变。
 * 场景：公开调教台加声望；有风险的场景在这里掷骰记事件（rng 只在有风险时消耗）。
 */
export function applyTrainingToSave(save: GameSave, result: TrainingResult, potionId?: string, rng: () => number = Math.random): GameSave {
  if (!result.ok) return save
  const inv = { ...(save.player.inventory ?? {}) }
  if (potionId && inv[potionId]) { inv[potionId] -= 1; if (inv[potionId] <= 0) delete inv[potionId] }
  const appeared = save.appearedToday ?? []
  const id = result.girl.id
  const before = save.girls.find((g) => g.id === id) ?? result.girl
  const risk = sceneRiskIncident(result.scene, before, result.girl, save.currentDay, rng)
  // 记忆以存档里的为准（亲自上场时可能刚「让她记住」了一句）
  const base = { ...result.girl, memory: before.memory, ...(risk ? { incident: risk } : {}) }
  const girlAfter = recordTraining(base, before, result, save.currentDay)
  return {
    ...save,
    dayLog: currentDayLog(save),  // 调教前先拍当天快照，小结里才看得到数值变化
    player: {
      ...save.player, inventory: inv,
      ...(result.reputationDelta ? { reputation: applyReputationDelta(save.player.reputation, result.reputationDelta) } : {}),
    },
    girls: save.girls.map((g) => (g.id === id ? girlAfter : g)),
    actionsUsedToday: Math.min(MAX_ACTIONS_PER_DAY, (save.actionsUsedToday ?? 0) + 1),
    appearedToday: appeared.includes(id) ? appeared : [...appeared, id],
  }
}
