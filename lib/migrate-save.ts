// 旧存档迁移：补齐新字段默认值（幂等，可重复调用）。由 game/page.tsx 载入时调用。
import type { GameSave, Guest, MonstGirl, Player } from './types'
import { defaultSensitivities, getDesireProfile } from './catalog'

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
  return {
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
  }
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

export function migrateSave(save: GameSave): GameSave {
  return {
    ...save,
    player: migratePlayer(save.player),
    girls: (save.girls ?? []).map(migrateGirl),
    actionsUsedToday: save.actionsUsedToday ?? 0,
    dailyGuests: save.dailyGuests?.map(migrateGuest),
    regulars: save.regulars?.map(migrateGuest),
  }
}
