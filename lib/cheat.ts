// 作弊 / 调试模式（默认关；开关记在存档里）。全部是纯函数：输入存档，返回新存档。
import type { GameSave, Guest, GuestClass, MonstGirl, SceneId, SensitivityZone, SkillKey, DesireKind } from './types'
import { createRandomGuest, GUEST_CLASSES, GUEST_DESIRES } from './game-engine'
import { getDesireProfile, OUTFITS, STOCKINGS, TRAINING_PROPS, MAX_STAMINA } from './catalog'
import { SCENE_IDS, FETISH_THRESHOLD, SHADOW_LEVEL_STEP } from './scenes'
import { presetGirl } from './archetypes'
import { migrateSave } from './migrate-save'
import { nextDayGuests, bestMain } from './guest-gen'
import { withDesire } from './guest-desire'
import { endDay } from './hub-logic'
import { PROF_MAX } from './proficiency'
import type { HeatState } from './arousal'

export interface CheatState { enabled: boolean; /** 解除每日限制：AI 润色客人不限当天一次、换客人免费不限次、送礼不限次 */ freeLimits?: boolean }
export const cheatOn = (save: Pick<GameSave, 'cheat'>): boolean => !!save.cheat?.enabled
export const freeLimits = (save: Pick<GameSave, 'cheat'>): boolean => !!save.cheat?.enabled && !!save.cheat?.freeLimits
export function setCheat(save: GameSave, patch: Partial<CheatState>): GameSave {
  return { ...save, cheat: { enabled: false, ...save.cheat, ...patch } }
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(n) ? n : 0)))

export function addGold(save: GameSave, n: number): GameSave {
  return { ...save, player: { ...save.player, gold: Math.max(0, save.player.gold + Math.round(n)) } }
}
export function addReputation(save: GameSave, n: number): GameSave {
  return { ...save, player: { ...save.player, reputation: clamp((save.player.reputation ?? 0) + n) } }
}

/** 可改的姑娘数值；fetishes = 已觉醒的性癖（场景 id），shadows = 场景 → 阴影档（0–3） */
export interface GirlStatPatch {
  affection?: number; obedience?: number; lewdness?: number; stamina?: number
  sensitivities?: Partial<Record<SensitivityZone, number>>
  proficiency?: Partial<Record<SkillKey, number>>
  fetishes?: SceneId[]
  shadows?: Partial<Record<SceneId, number>>
}
export function setGirlStats(save: GameSave, girlId: string, p: GirlStatPatch): GameSave {
  return { ...save, girls: save.girls.map((g) => (g.id === girlId ? patchGirl(g, p) : g)) }
}
export function patchGirl(g: MonstGirl, p: GirlStatPatch): MonstGirl {
  const out: MonstGirl = { ...g }
  for (const k of ['affection', 'obedience', 'lewdness'] as const) if (p[k] !== undefined) out[k] = clamp(p[k]!)
  if (p.stamina !== undefined) { out.stamina = clamp(p.stamina, 0, MAX_STAMINA); if (out.stamina > 0) out.exhausted = false }
  if (p.sensitivities) out.sensitivities = { ...g.sensitivities, ...Object.fromEntries(Object.entries(p.sensitivities).map(([z, v]) => [z, clamp(v ?? 0)])) }
  if (p.proficiency) out.proficiency = { ...g.proficiency, ...Object.fromEntries(Object.entries(p.proficiency).map(([s, v]) => [s, clamp(v ?? 0, 0, PROF_MAX)])) }
  if (p.fetishes) {
    out.awakened = [...new Set(p.fetishes)]
    const st = { ...g.sceneState }
    for (const id of out.awakened) st[id] = { uses: st[id]?.uses ?? [], sp: st[id]?.sp ?? 0, fp: Math.max(st[id]?.fp ?? 0, FETISH_THRESHOLD) }
    out.sceneState = st
  }
  if (p.shadows) {
    const st = { ...out.sceneState }
    for (const [id, lv] of Object.entries(p.shadows) as [SceneId, number][]) {
      const cur = st[id] ?? { uses: [], fp: 0, sp: 0 }
      st[id] = { ...cur, sp: clamp(lv, 0, 3) * SHADOW_LEVEL_STEP }
    }
    out.sceneState = st
  }
  return out
}

/** 设施满级、全部场景 / 衣橱 / 调教道具到手 */
export function unlockAll(save: GameSave): GameSave {
  const p = save.player
  return {
    ...save,
    player: {
      ...p,
      dormLevel: 4, serviceRoomLevel: 4, trainingRoomLevel: 4,
      wardrobe: [...new Set([...(p.wardrobe ?? []), ...OUTFITS.filter((o) => o.id !== 'regular').map((o) => o.id), ...STOCKINGS.filter((s) => s.id !== 'none').map((s) => s.id)])],
      ownedScenes: [...new Set([...(p.ownedScenes ?? []), ...SCENE_IDS])],
      ownedTrainingProps: [...new Set([...(p.ownedTrainingProps ?? []), ...TRAINING_PROPS.map((t) => t.id)])],
    },
  }
}

/** 直接把预设姑娘加进馆里（不占金币，不受人数上限） */
export function addPresetGirl(save: GameSave, name: string, id: string): GameSave | { error: string } {
  const g = presetGirl(name, id)
  if (!g) return { error: `没有叫「${name}」的预设` }
  if (save.girls.some((x) => x.name === name)) return { error: `${name}已经在馆里了` }
  return migrateSave({ ...save, girls: [...save.girls, g] })
}

export function restoreStamina(save: GameSave, girlId?: string): GameSave {
  return { ...save, girls: save.girls.map((g) => (!girlId || g.id === girlId ? { ...g, stamina: MAX_STAMINA, exhausted: false } : g)) }
}
export function resetActions(save: GameSave): GameSave {
  return { ...save, actionsUsedToday: 0, appearedToday: [] }
}

/** 立刻结束今天（与大厅「结束今天」同一结算） */
export const endDayNow = (save: GameSave): GameSave => endDay(save)
/** 跳到第 N 天：不跑夜间结算，只换日子、清行动、刷新客人池 */
export function skipToDay(save: GameSave, day: number): GameSave {
  const d = Math.max(1, Math.round(day))
  return { ...save, currentDay: d, actionsUsedToday: 0, appearedToday: [], machineNightGirlId: undefined, dailyGuests: nextDayGuests(save, d) }
}

export interface GuestSpec {
  race?: string           // 偏好种族
  trait?: string          // 偏好身材（巨乳/贫乳/丰臀/兽耳）
  desires?: string        // 需求文本（决定主类型、M/S 与对口 play）
  main?: '口侍' | '胸侍' | '身侍'
  kind?: DesireKind
  guestClass?: GuestClass
  personality?: string
  prefOutfit?: Guest['prefOutfit']
}
/** 按指定偏好造一位客人（本地，不调用 AI） */
export function makeGuest(save: GameSave, spec: GuestSpec, rng: () => number = Math.random): Guest {
  let g = createRandomGuest(save.player.reputation ?? 0)
  if (spec.desires && GUEST_DESIRES.includes(spec.desires)) {
    const p = getDesireProfile(spec.desires)
    g = { ...g, desires: spec.desires, desireKind: p.kind, desireService: p.service }
  } else if (spec.main || spec.kind) g = withDesire(g, spec.main ?? null, spec.kind, rng)
  if (spec.guestClass) {
    const def = GUEST_CLASSES[spec.guestClass]
    const baseRace = g.race.includes('·') ? g.race.split('·').pop()! : g.race
    g = { ...g, guestClass: spec.guestClass, demand: def.demand, race: spec.guestClass === 'commoner' ? baseRace : `${def.label}·${baseRace}`, imageTags: `1man, ${def.tags}, anime, masterpiece, best quality` }
  }
  if (spec.race) g = { ...g, prefRace: spec.race }
  if (spec.trait) g = { ...g, prefTrait: spec.trait }
  if (spec.personality) g = { ...g, personality: spec.personality }
  if (spec.prefOutfit !== undefined) g = { ...g, prefOutfit: spec.prefOutfit }
  return { ...g, aiFlavored: true }
}
/** 为某位姑娘造一位「合适」的客人：偏好她的种族、主类型是她最拿手的那项 */
export function matchingGuestSpec(girl: MonstGirl): GuestSpec {
  return { race: girl.race, main: bestMain(girl) }
}
export function spawnGuest(save: GameSave, guest: Guest): GameSave {
  return { ...save, dailyGuests: [guest, ...(save.dailyGuests ?? [])] }
}

/** 会话内：设某人（'guest' 或魔物娘 id）的兴奋 / 快感（0–100） */
export function setHeatValues(h: HeatState, who: string, v: { arousal?: number; pleasure?: number }): HeatState {
  const cur = (who === 'guest' ? h.guest : h.girls[who]) ?? { arousal: 0, pleasure: 0, climaxes: 0 }
  const next = { ...cur, ...(v.arousal !== undefined ? { arousal: clamp(v.arousal) } : {}), ...(v.pleasure !== undefined ? { pleasure: clamp(v.pleasure) } : {}) }
  return who === 'guest' ? { ...h, guest: next } : { ...h, girls: { ...h.girls, [who]: next } }
}
