// 大厅经营动作（纯函数）：送礼、休息、宿舍升级、结束今天、技能选择
import type { GameSave, Guest, MonstGirl, SkillKey } from './types'
import {
  DORM_LEVELS, DORM_UPGRADE_COSTS, MAX_STAMINA, REST_STAMINA, MAX_SERVING_SKILLS,
  SKILL_PICK_THRESHOLDS, getUpgradeCostFor,
} from './catalog'
import { MAX_ACTIONS_PER_DAY, generateDailyGuests, getGuestCapacity } from './game-engine'

export type HubResult = { ok: true; save: GameSave; message: string } | { ok: false; error: string }

const replaceGirl = (save: GameSave, g: MonstGirl): MonstGirl[] => save.girls.map((x) => (x.id === g.id ? g : x))
const clampStamina = (n: number) => Math.max(0, Math.min(MAX_STAMINA, n))

// ─── 送礼：全馆每天一次，当场扣钱 ──────────────────────────────────────────────

export const GIFT_OPTIONS = [
  { name: '小礼物', cost: 20, affectionBonus: 5 },
  { name: '精美首饰', cost: 80, affectionBonus: 15 },
  { name: '稀有宝石', cost: 200, affectionBonus: 30 },
]

export function canGiveGiftToday(save: GameSave): boolean {
  return save.player.giftGivenOnDay !== save.currentDay
}

export function giveGift(save: GameSave, girlId: string, giftIndex: number): HubResult {
  const gift = GIFT_OPTIONS[giftIndex]
  const girl = save.girls.find((g) => g.id === girlId)
  if (!gift || !girl) return { ok: false, error: '无效的礼物或魔物娘' }
  if (!canGiveGiftToday(save)) return { ok: false, error: '今天已经送过礼了（全馆每天一次）' }
  if (save.player.gold < gift.cost) return { ok: false, error: '金币不足' }
  const updated = { ...girl, affection: Math.min(100, girl.affection + gift.affectionBonus) }
  return {
    ok: true,
    message: `送出了「${gift.name}」！${girl.name} 的好感度 +${gift.affectionBonus}`,
    save: {
      ...save,
      player: { ...save.player, gold: save.player.gold - gift.cost, giftGivenOnDay: save.currentDay },
      girls: replaceGirl(save, updated),
    },
  }
}

// ─── 休息：占 1 次行动，体力 +50 ────────────────────────────────────────────────

export function restGirl(save: GameSave, girlId: string): HubResult {
  const girl = save.girls.find((g) => g.id === girlId)
  if (!girl) return { ok: false, error: '找不到这名魔物娘' }
  const used = save.actionsUsedToday ?? 0
  if (used >= MAX_ACTIONS_PER_DAY) return { ok: false, error: '今日行动已用尽' }
  const before = girl.stamina ?? MAX_STAMINA
  const updated = { ...girl, stamina: clampStamina(before + REST_STAMINA) }
  const appeared = save.appearedToday ?? []
  return {
    ok: true,
    message: `${girl.name} 休息了一会儿，体力 ${before} → ${updated.stamina}`,
    save: {
      ...save,
      actionsUsedToday: used + 1,
      girls: replaceGirl(save, updated),
      appearedToday: appeared.includes(girl.id) ? appeared : [...appeared, girl.id],
    },
  }
}

// ─── 宿舍 ─────────────────────────────────────────────────────────────────────

export function getDormInfo(level?: number) {
  const lv = Math.max(1, Math.min(DORM_LEVELS.length, level ?? 1))
  return { level: lv, ...DORM_LEVELS[lv - 1], upgradeCost: getUpgradeCostFor(DORM_UPGRADE_COSTS, lv) }
}

export function upgradeDorm(save: GameSave): HubResult {
  const { level, upgradeCost } = getDormInfo(save.player.dormLevel)
  if (upgradeCost === null) return { ok: false, error: '宿舍已满级' }
  if (save.player.gold < upgradeCost) return { ok: false, error: '金币不足' }
  const next = getDormInfo(level + 1)
  return {
    ok: true,
    message: `宿舍升级为「${next.name}」`,
    save: { ...save, player: { ...save.player, gold: save.player.gold - upgradeCost, dormLevel: level + 1 } },
  }
}

/** 宿舍夜间回复量（单间指定的那一人再 +15） */
export function nightlyRecovery(save: GameSave, girl: MonstGirl): number {
  const dorm = getDormInfo(save.player.dormLevel)
  return dorm.nightly + (dorm.bestBedBonus && save.bestBedGirlId === girl.id ? dorm.bestBedBonus : 0)
}

// ─── 结束今天：宿舍回复、行动归零、刷新客人池 ─────────────────────────────────

export function endDay(save: GameSave): GameSave {
  const dorm = getDormInfo(save.player.dormLevel)
  const girls = save.girls.map((g) => ({
    ...g,
    stamina: clampStamina((g.stamina ?? MAX_STAMINA) + nightlyRecovery(save, g)),
    exhausted: dorm.clearsExhaustion ? false : g.exhausted,
  }))
  return {
    ...save,
    currentDay: save.currentDay + 1,
    actionsUsedToday: 0,
    appearedToday: [],
    girls,
    dailyGuests: generateDailyGuests(getGuestCapacity(save.player.level), save.player.reputation ?? 0, save.regulars ?? []),
  }
}

// ─── 技能选择：服从 30 / 淫乱 40 / 好感 50 各一次，最多 3 个，M/S 互斥 ───────

export const PICKABLE_SKILLS: SkillKey[] = ['口侍', '胸侍', '身侍', '手技', '待客', 'M性', 'S性']

export function ownedSkillCount(girl: MonstGirl): number {
  return Object.keys(girl.skillRanks ?? {}).length
}

/** 已到达但还没用掉的技能选择次数 */
export function pendingSkillPicks(girl: MonstGirl): number {
  const reached = SKILL_PICK_THRESHOLDS.filter((t) => girl[t.stat] >= t.value).length
  return Math.max(0, Math.min(MAX_SERVING_SKILLS, reached) - ownedSkillCount(girl))
}

export function selectableSkills(girl: MonstGirl): SkillKey[] {
  const owned = girl.skillRanks ?? {}
  const hasMS = !!owned['M性'] || !!owned['S性']
  return PICKABLE_SKILLS.filter((s) => !owned[s] && !((s === 'M性' || s === 'S性') && hasMS))
}

export function pickSkill(girl: MonstGirl, skill: SkillKey): MonstGirl | null {
  if (pendingSkillPicks(girl) <= 0 || !selectableSkills(girl).includes(skill)) return null
  const next: MonstGirl = { ...girl, skillRanks: { ...girl.skillRanks, [skill]: '初学' } }
  if (skill === 'M性') next.inclination = 'M'
  if (skill === 'S性') next.inclination = 'S'
  return next
}

// ─── 新魔物娘入馆：领头人与本地模板 ───────────────────────────────────────────

/** 领头人好感门槛（待确认数值） */
export const ARRIVAL_LEADER_MIN_AFFECTION = 50

export type ArrivalLeader = { kind: 'girl'; girl: MonstGirl } | { kind: 'player' }

/** 馆内（不含新人）好感最高且 ≥50 的魔物娘领头；并列取先入馆者；都不到时由馆主出面 */
export function pickArrivalLeader(girls: MonstGirl[], newGirlId: string): ArrivalLeader {
  let best: MonstGirl | null = null
  for (const g of girls) {
    if (g.id === newGirlId || g.affection < ARRIVAL_LEADER_MIN_AFFECTION) continue
    if (!best || g.affection > best.affection) best = g
  }
  return best ? { kind: 'girl', girl: best } : { kind: 'player' }
}

export function arrivalFallbackText(leader: ArrivalLeader, playerName: string, newGirl: MonstGirl): string {
  return leader.kind === 'girl'
    ? `${leader.girl.name}领着${newGirl.name}在馆里转了一圈，把规矩一条条交代清楚，末了拍拍她的肩：「以后就是自己人了。」`
    : `${playerName}亲自把${newGirl.name}领进门，带她看过房间和大厅。${newGirl.name}四处打量着，神情还有些拘谨。`
}

export function arrivalPromptNote(leader: ArrivalLeader, playerName: string, newGirl: MonstGirl): string {
  return leader.kind === 'girl'
    ? `【入馆安排】由馆里好感最高的魔物娘${leader.girl.name}（${leader.girl.race}，性格：${leader.girl.personality}）出面迎接新人${newGirl.name}，带她熟悉娼馆、交代规矩。以${leader.girl.name}为主导写这段入馆对话。`
    : `【入馆安排】由馆主${playerName}亲自迎接新人${newGirl.name}，带她熟悉娼馆。以馆主为主导写这段入馆对话。`
}

// ─── 常客关系记忆：合并进回头客池 ─────────────────────────────────────────────


/** 回头客池里有这位客人时，用新记忆覆盖；没有时原样返回 */
export function mergeRegularMemories(regulars: Guest[], guestId: string, memories: NonNullable<Guest['memories']>): Guest[] {
  return regulars.map((r) => (r.id === guestId ? { ...r, memories } : r))
}

/** 把一位魔物娘的新印象并入已有记忆，visitCount 递增 */
export function mergeGirlMemory(
  existing: Guest['memories'], girlName: string, parsed: { guestAboutGirl?: string; girlAboutGuest?: string },
): NonNullable<Guest['memories']> {
  const prev = existing?.[girlName]
  return {
    ...(existing ?? {}),
    [girlName]: {
      guestAboutGirl: parsed.guestAboutGirl ?? '',
      girlAboutGuest: parsed.girlAboutGuest ?? '',
      visitCount: (prev?.visitCount ?? 0) + 1,
    },
  }
}
