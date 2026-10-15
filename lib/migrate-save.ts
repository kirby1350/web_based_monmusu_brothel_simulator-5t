// 旧存档迁移：补齐新字段默认值（幂等，可重复调用）。由 game/page.tsx 载入时调用。
import type { GameSave, Guest, MonstGirl, Player } from './types'
import { defaultSensitivities, getDesireProfile } from './catalog'
import { normalizeDayLog, freshDayLog } from './day-summary'
import { refreshPresetText } from './preset-refresh'

export function migratePlayer(p: Player): Player {
  return {
    ...p,
    level: p.level ?? 1,
    reputation: p.reputation ?? 0,
    dormLevel: p.dormLevel ?? 1,
    serviceRoomLevel: p.serviceRoomLevel ?? 1,
    trainingRoomLevel: p.trainingRoomLevel ?? 1,
    wardrobe: p.wardrobe ?? [],
    inventory: p.inventory ?? {},
    ownedTrainingProps: p.ownedTrainingProps ?? [],
    customProps: p.customProps ?? [],
  }
}

/** 旧种族名 → 目录种族名 */
export const RACE_RENAMES: Record<string, string> = { 阿拉克涅: '蜘蛛娘', 美杜莎: '拉米亚' }

export function migrateGirl(raw: MonstGirl): MonstGirl {
  const g = RACE_RENAMES[raw.race] ? { ...raw, race: RACE_RENAMES[raw.race] } : raw
  // 预设角色的旧文案（玩家没改过的字段）刷新为当前版本；数值与进度不动
  return refreshPresetText({
    ...g,
    skills: g.skills ?? [],
    incident: g.incident ?? null,
    stamina: g.stamina ?? 100,
    exhausted: g.exhausted ?? false,
    skillRanks: g.skillRanks ?? {},
    inclination: g.inclination ?? '无',
    msProgress: g.msProgress ?? { m: 0, s: 0 },
    skillProgress: g.skillProgress ?? {},
    sensitivities: { ...defaultSensitivities(g.race), ...(g.sensitivities ?? {}) },
    sculptCounts: g.sculptCounts ?? { bust: 0, waist: 0, hip: 0 },
  })
}

export function migrateGuest(guest: Guest): Guest {
  const profile = getDesireProfile(guest.desires ?? '')
  return {
    ...guest,
    desireKind: guest.desireKind ?? profile.kind,
    desireService: guest.desireService ?? profile.service,
    prefOutfit: guest.prefOutfit === undefined ? null : guest.prefOutfit,
    ...(guest.prefRace && RACE_RENAMES[guest.prefRace] ? { prefRace: RACE_RENAMES[guest.prefRace] } : {}),
    ...(RACE_RENAMES[guest.race] ? { race: RACE_RENAMES[guest.race] } : {}),
  }
}

/** 当前存档格式版本。v1：带 saveVersion + tutorial 字段 */
export const SAVE_VERSION = 1

export function migrateSave(save: GameSave): GameSave {
  const from = save.saveVersion ?? 0
  const out: GameSave = {
    ...save,
    saveVersion: Math.max(from, SAVE_VERSION),
    // v0 → v1：已经过了第一天的老存档不再弹引导
    tutorial: save.tutorial ?? { step: 0, dismissed: (save.currentDay ?? save.player?.day ?? 1) > 1 },
    player: migratePlayer(save.player),
    girls: (save.girls ?? []).map(migrateGirl),
    actionsUsedToday: save.actionsUsedToday ?? 0,
    dailyGuests: save.dailyGuests?.map(migrateGuest),
    regulars: save.regulars?.map(migrateGuest),
  }
  return { ...out, dayLog: normalizeDayLog(out) }
}

/** 导出：带版本号的 JSON 文本 */
export function exportSaveJson(save: GameSave): string {
  return JSON.stringify(migrateSave(save), null, 2)
}

/** 导入：解析 + 校验 + 迁移。失败返回 { error } */
export function importSaveJson(text: string): { save: GameSave } | { error: string } {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return { error: '不是合法的 JSON' } }
  const o = parsed as Partial<GameSave> | null
  if (!o || typeof o !== 'object' || !o.player || typeof o.player !== 'object' || !Array.isArray(o.girls)) {
    return { error: '缺少 player / girls，不像是本游戏的存档' }
  }
  if ((o.saveVersion ?? 0) > SAVE_VERSION) return { error: `存档版本 v${o.saveVersion} 比当前游戏 v${SAVE_VERSION} 新，请先更新游戏` }
  // 导入的存档从此刻起重开当天账本：导入本身造成的金币/声望跳变不计入小结
  const m = migrateSave(o as GameSave)
  return { save: { ...m, dayLog: freshDayLog(m), lastDaySummary: null } }
}
