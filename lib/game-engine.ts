import { MonstGirl, Guest, ParticipantStats, ServiceSession, Player } from '@/lib/types'
import { parseLooseJson } from '@/lib/utils'
import { GUEST_RACES, GUEST_PERSONALITIES, GUEST_TRAITS, RACES } from '@/lib/game-data'
import { nanoid } from 'nanoid'

// ─── 经营机制：行动次数 / 容量 / 升级 ──────────────────────────────────────────

/** 每天最多进行的行动次数（接客 / 调教） */
export const MAX_ACTIONS_PER_DAY = 3

const BASE_GIRL_CAPACITY = 3      // 1 级时可持有的魔物娘上限
const BASE_GUEST_CAPACITY = 2     // 1 级时每天随机生成的客人上限
const GIRL_CAP_PER_LEVEL = 1      // 每升 1 级 +1 魔物娘上限
const GUEST_CAP_PER_LEVEL = 1     // 每升 1 级 +1 每日客人上限

/** 当前等级下的魔物娘持有上限 */
export function getGirlCapacity(level?: number): number {
  return BASE_GIRL_CAPACITY + Math.max(0, (level ?? 1) - 1) * GIRL_CAP_PER_LEVEL
}

/** 当前等级下每天随机生成的客人上限 */
export function getGuestCapacity(level?: number): number {
  return BASE_GUEST_CAPACITY + Math.max(0, (level ?? 1) - 1) * GUEST_CAP_PER_LEVEL
}

/** 从当前等级升到下一级所需金币（随等级递增） */
export function getUpgradeCost(level?: number): number {
  return 500 * (level ?? 1)
}

// ─── 每日客人随机生成（无需 AI，开局即生成） ──────────────────────────────────

const GUEST_NAMES = ['雷克', '阿尔', '马克', '路德', '凯因', '托尔', '巴德', '格伦', '维克', '罗恩', '希德', '加洛']
const GUEST_DESIRES = [
  '想把魔物娘的子宫灌满精液',
  '渴望被傲娇的魔物娘嫌弃着榨干',
  '想要温柔的乳交与深喉服务',
  '执着于尾巴与兽耳的玩弄',
  '想把高傲的魔物娘彻底操服',
  '追求长时间的多次内射',
  '想体验被主动求欢的痴女侍奉',
  '渴望粗暴支配与言语羞辱',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 带兽耳/兽尾的种族（用于「兽耳」偏好判定）
const BEAST_RACES = ['猫娘', '犬娘', '狐娘', '兔娘', '牛娘', '狼娘']

// 客人「偏好特征」表：每项对在场魔物娘属性可判定
const GUEST_FETISH_PREFS: { tag: string; matches: (g: MonstGirl) => boolean }[] = [
  { tag: '巨乳', matches: (g) => (g.bust ?? 0) >= 95 },
  { tag: '贫乳', matches: (g) => (g.bust ?? 0) > 0 && (g.bust ?? 0) <= 82 },
  { tag: '丰臀', matches: (g) => (g.hip ?? 0) >= 95 },
  { tag: '兽耳', matches: (g) => BEAST_RACES.includes(g.race) },
]

const BASE_GUEST_BUDGET = 65        // 声望 0 时客人的基础预算下限
const REGULAR_RETURN_CHANCE = 0.4   // 每名回头客每天回访的概率
const MATCH_BONUS = 15              // 命中一项偏好带来的初始满意度加成

/** 客人基础预算：随声望线性提升，叠加少量随机 */
function rollGuestBudget(reputation: number): number {
  return BASE_GUEST_BUDGET + Math.round(reputation * 1.2) + Math.floor(Math.random() * 40)
}

/** 随机生成一名客人（本地随机，不调用 AI）。reputation 越高，预算越高 */
export function createRandomGuest(reputation = 0): Guest {
  return {
    id: nanoid(),
    name: pick(GUEST_NAMES),
    race: pick(GUEST_RACES),
    personality: pick(GUEST_PERSONALITIES),
    traits: [pick(GUEST_TRAITS)],
    desires: pick(GUEST_DESIRES),
    imageTags: '1man, adventurer, anime, masterpiece, best quality',
    satisfaction: 0,
    budget: rollGuestBudget(reputation),
    visits: 0,
    prefRace: pick(RACES).name,
    prefTrait: pick(GUEST_FETISH_PREFS).tag,
  }
}

// ─── 开场偏好匹配 → 初始满意度 ─────────────────────────────────────────────────

export interface GuestMatch {
  raceMatched: boolean
  traitMatched: boolean
  bonus: number
}

/** 判定客人偏好与在场魔物娘的匹配情况 */
export function getGuestMatch(guest: Guest, girls: MonstGirl[]): GuestMatch {
  const raceMatched = !!guest.prefRace && girls.some((g) => g.race === guest.prefRace)
  const pref = GUEST_FETISH_PREFS.find((p) => p.tag === guest.prefTrait)
  const traitMatched = !!pref && girls.some((g) => pref.matches(g))
  const bonus = (raceMatched ? MATCH_BONUS : 0) + (traitMatched ? MATCH_BONUS : 0)
  return { raceMatched, traitMatched, bonus }
}

/** 开场时根据偏好匹配计算客人的初始满意度（0–100） */
export function computeInitialSatisfaction(guest: Guest, girls: MonstGirl[]): number {
  return Math.min(100, getGuestMatch(guest, girls).bonus)
}

/**
 * 生成当天的客人池：先让回头客按概率回访（保留其记忆与累计次数），
 * 剩余名额用新随机客人补足。
 */
export function generateDailyGuests(count: number, reputation = 0, regulars: Guest[] = []): Guest[] {
  const guests: Guest[] = []
  const shuffled = [...regulars].sort(() => Math.random() - 0.5)
  for (const r of shuffled) {
    if (guests.length >= count) break
    if (Math.random() < REGULAR_RETURN_CHANCE) {
      // 回访时重置当次会话满意度，但保留预算/记忆/累计次数
      guests.push({ ...r, satisfaction: 0 })
    }
  }
  while (guests.length < count) guests.push(createRandomGuest(reputation))
  return guests
}

// ─── 满意度分档 / 声望 ──────────────────────────────────────────────────────────

export type SatisfactionTierKey = 'unsatisfied' | 'normal' | 'satisfied' | 'ecstatic'

export interface SatisfactionTier {
  key: SatisfactionTierKey
  label: string
  payMult: number          // 收入倍率
  reputationDelta: number  // 声望增减
  regularChance: number    // 成为回头客的概率
}

/** 根据服务结束时的客人满意度返回结算分档 */
export function getSatisfactionTier(satisfaction: number): SatisfactionTier {
  if (satisfaction >= 90) return { key: 'ecstatic', label: '极乐', payMult: 1.6, reputationDelta: 5, regularChance: 0.8 }
  if (satisfaction >= 70) return { key: 'satisfied', label: '满意', payMult: 1.3, reputationDelta: 3, regularChance: 0.4 }
  if (satisfaction >= 30) return { key: 'normal', label: '一般', payMult: 1.0, reputationDelta: 1, regularChance: 0 }
  return { key: 'unsatisfied', label: '不满', payMult: 0.5, reputationDelta: -2, regularChance: 0 }
}

/** 声望增减并 clamp 到 0–100 */
export function applyReputationDelta(reputation: number | undefined, delta: number): number {
  return Math.max(0, Math.min(100, (reputation ?? 0) + delta))
}

/** 判定本次服务后该客人是否成为/续约回头客 */
export function rollBecameRegular(tier: SatisfactionTier): boolean {
  return Math.random() < tier.regularChance
}

// ─── 侍奉技能解锁 ───────────────────────────────────────────────────────────────

// 解锁规则：技能名取自 game-data 的 SERVING_SKILLS，每个对应一组数值阈值（纯函数判定，无随机）
const SKILL_UNLOCK_RULES: { skill: string; meets: (g: MonstGirl) => boolean }[] = [
  { skill: '口技', meets: (g) => g.obedience >= 30 },
  { skill: '手技', meets: (g) => g.obedience >= 30 },
  { skill: '体位变换', meets: (g) => g.lewdness >= 40 },
  { skill: '按摩', meets: (g) => g.lewdness >= 40 },
  { skill: '魅惑舞蹈', meets: (g) => g.affection >= 50 },
  { skill: '低语诱惑', meets: (g) => g.affection >= 50 },
  { skill: '多重服侍', meets: (g) => g.lewdness >= 70 },
  { skill: '特殊技巧', meets: (g) => g.obedience >= 80 && g.lewdness >= 80 },
]

/**
 * 根据魔物娘当前数值，返回她「应当已解锁、但尚未拥有」的新技能列表。
 * 在数值成长结算之后调用，把返回的技能追加到 girl.skills 即可。
 */
export function evaluateSkillUnlocks(girl: MonstGirl): string[] {
  return SKILL_UNLOCK_RULES
    .filter((r) => r.meets(girl) && !girl.skills.includes(r.skill))
    .map((r) => r.skill)
}

// ─── STATS 块解析 ──────────────────────────────────────────────────────────────

// 标记定位正则——容错要点（模型经常违反格式）：
// - STATS 后的冒号容半角/全角 [:：]；标记名与冒号间容空白
// - 捕获组懒惰匹配且不跨越下一个 <!--，防止贪婪吞掉后续块
// - 内层 JSON 的全角符号 / 截断由 extractBracketed + parseLooseJson 处理
const STATS_REGEX = /<!--\s*STATS\s*[:：]\s*((?:(?!<!--)[\s\S])*?)\s*-->/
const ACTIONS_REGEX = /<!--\s*ACTIONS\s*[:：]\s*((?:(?!<!--)[\s\S])*?)\s*-->/

// 从一段原始文本里截出最外层的 {...} 或 [...]（容全角括号、首尾多余字符）。
// 找不到闭合符号时（截断）原样返回，交给 parseLooseJson 的截断修复兜底。
function extractBracketed(raw: string, kind: 'object' | 'array'): string {
  const opens = kind === 'object' ? '{｛' : '[［'
  const closes = kind === 'object' ? '}｝' : ']］'
  let start = -1
  for (let i = 0; i < raw.length; i++) { if (opens.includes(raw[i])) { start = i; break } }
  let end = -1
  for (let i = raw.length - 1; i >= 0; i--) { if (closes.includes(raw[i])) { end = i; break } }
  return start >= 0 && end > start ? raw.slice(start, end + 1) : raw.slice(start >= 0 ? start : 0)
}

export interface SingleStatsDelta {
  pleasureDelta: number
  staminaDelta: number
  satisfactionDelta: number
}

export interface MultiStatsDelta {
  girls: Record<string, { pleasureDelta: number; staminaDelta: number }>
  satisfactionDelta: number
}

/**
 * 从 AI 回复中解析多角色隐藏数值块。
 * 新格式：<!--STATS:{"girls":{"名字":{"pleasure":N,"stamina":N},...},"satisfaction":N}-->
 * 旧格式（单块）：<!--STATS:{"pleasure":N,"stamina":N,"satisfaction":N}-->
 * 返回 null 表示未找到。
 */
export function parseStatsFromReply(text: string): MultiStatsDelta | null {
  const match = text.match(STATS_REGEX)
  if (!match) return null
  try {
    const jsonStr = extractBracketed(match[1], 'object')
    const obj = parseLooseJson<Record<string, unknown> & { satisfaction?: unknown; girls?: unknown; pleasure?: unknown; stamina?: unknown }>(jsonStr)
    if (!obj) return null
    const satisfactionDelta = Math.max(-5, Math.min(20, Number(obj.satisfaction) || 0))

    // 新多角色格式
    if (obj.girls && typeof obj.girls === 'object') {
      const girls: Record<string, { pleasureDelta: number; staminaDelta: number }> = {}
      for (const [name, vals] of Object.entries(obj.girls as Record<string, { pleasure?: number; stamina?: number }>)) {
        girls[name] = {
          pleasureDelta: Math.max(-10, Math.min(20, Number(vals.pleasure) || 0)),
          staminaDelta: Math.max(-20, Math.min(-2, Number(vals.stamina) || -8)),
        }
      }
      return { girls, satisfactionDelta }
    }

    // 旧单块格式：所有角色共享
    const shared = {
      pleasureDelta: Math.max(-10, Math.min(20, Number(obj.pleasure) || 0)),
      staminaDelta: Math.max(-20, Math.min(-2, Number(obj.stamina) || -8)),
    }
    return { girls: { __shared__: shared }, satisfactionDelta }
  } catch {
    return null
  }
}

/**
 * 从 MultiStatsDelta 中获取特定角色的 delta，找不到时返回 shared 或 null。
 */
export function getGirlDelta(
  multi: MultiStatsDelta,
  girlName: string
): { pleasureDelta: number; staminaDelta: number } | null {
  if (multi.girls[girlName]) return multi.girls[girlName]
  if (multi.girls['__shared__']) return multi.girls['__shared__']
  return null
}

/**
 * 从 AI 回复中解析推荐行动块 <!--ACTIONS:[...]-->
 * 返回三个行动字符串，失败时返回 null。
 */
export function parseActionsFromReply(text: string): [string, string, string] | null {
  const match = text.match(ACTIONS_REGEX)
  if (!match) return null
  try {
    const arr = parseLooseJson<string[]>(extractBracketed(match[1], 'array'))
    if (!Array.isArray(arr) || arr.length < 3) return null
    return [arr[0], arr[1], arr[2]]
  } catch {
    return null
  }
}

/**
 * 剥离回复中的隐藏 STATS 和 ACTIONS 块，返回干净的显示文本。
 */
export function stripStatsBlock(text: string): string {
  return text.replace(STATS_REGEX, '').replace(ACTIONS_REGEX, '').trimEnd()
}

// ─── 服务/调教数值计算 ──────────────────────────────────────────────────────────

/**
 * 根据AI回复内容关键词估算数值变化
 */
export function estimateStatDelta(text: string): {
  pleasureDelta: number
  staminaDelta: number
} {
  const lowerText = text.toLowerCase()

  // 快感提升关键词
  const pleasureUpWords = ['呻吟', '颤抖', '高潮', '快感', '喘息', '颤栗', '销魂', '舒服', '满足', '享受']
  const pleasureDownWords = ['抵抗', '拒绝', '挣扎', '哭泣', '疼痛', '不舒服']

  // 体力消耗关键词
  const staminaHighDrainWords = ['激烈', '猛烈', '疯狂', '不停', '连续', '极限']
  const staminaLowDrainWords = ['轻柔', '温柔', '缓慢', '轻轻', '休息']

  let pleasureDelta = 5
  let staminaDelta = -8

  for (const w of pleasureUpWords) {
    if (text.includes(w)) pleasureDelta += 4
  }
  for (const w of pleasureDownWords) {
    if (text.includes(w)) pleasureDelta -= 3
  }
  for (const w of staminaHighDrainWords) {
    if (text.includes(w)) staminaDelta -= 5
  }
  for (const w of staminaLowDrainWords) {
    if (text.includes(w)) staminaDelta += 3
  }

  return {
    pleasureDelta: Math.max(0, Math.min(20, pleasureDelta)),
    staminaDelta: Math.max(-25, Math.min(-2, staminaDelta)),
  }
}

/**
 * 应用数值变化，处理体力归零
 */
export function applyStatDelta(
  stats: ParticipantStats,
  delta: { pleasureDelta: number; staminaDelta: number }
): ParticipantStats {
  const newStamina = Math.max(0, Math.min(100, stats.stamina + delta.staminaDelta))
  const newPleasure = Math.max(0, Math.min(100, stats.pleasure + delta.pleasureDelta))
  return {
    pleasure: newPleasure,
    stamina: newStamina,
    isExhausted: newStamina === 0,
  }
}

// 每个已解锁侍奉技能为本次服务带来的收入加成
const SKILL_REWARD_BONUS = 8

/**
 * 计算服务结束后的金币收入。
 * 收入 =（客人预算 + 回头客累计加成 + 多魔物娘加成 + 技能加成）× 满意度分档倍率
 */
export function calcServiceReward(guest: Guest, session: ServiceSession): number {
  const visitBonus = (guest.visits ?? 0) * 20            // 回头客每回访一次基底 +20
  const base = (guest.budget ?? 80) + visitBonus
  const girlCountBonus = (session.girls.length - 1) * 25
  const skillBonus = session.girls.reduce((sum, g) => sum + g.skills.length * SKILL_REWARD_BONUS, 0)
  const tier = getSatisfactionTier(guest.satisfaction)
  const subtotal = base + girlCountBonus + skillBonus
  return Math.max(30, Math.round(subtotal * tier.payMult))
}

/**
 * 计算服务/调教后魔物娘属性变化
 */
export function calcGirlStatGrowth(
  girl: MonstGirl,
  session: ServiceSession,
  turnCount: number
): Partial<MonstGirl> {
  const stats = session.girlsStats[girl.id]
  if (!stats) return {}

  const pleasureRatio = stats.pleasure / 100
  const isTraining = session.type === 'training'

  // 好感度：服务中适度提升
  const affectionDelta = isTraining
    ? Math.floor(Math.random() * 3) + 2
    : Math.floor(pleasureRatio * 5) + 1

  // 服从度：调教场景提升更多
  const obedienceDelta = isTraining
    ? Math.floor(Math.random() * 5) + 3
    : Math.floor(Math.random() * 2)

  // 淫乱度：高快感时提升
  const lewdnessDelta = stats.pleasure > 70
    ? Math.floor(Math.random() * 4) + 2
    : Math.floor(Math.random() * 2)

  return {
    affection: Math.min(100, girl.affection + affectionDelta),
    obedience: Math.min(100, girl.obedience + obedienceDelta),
    lewdness: Math.min(100, girl.lewdness + lewdnessDelta),
  }
}

/**
 * 初始化会话数值
 */
export function initParticipantStats(): ParticipantStats {
  return { pleasure: 0, stamina: 100, isExhausted: false }
}

/**
 * 初始化服务会话
 */
export function createServiceSession(
  type: 'service' | 'training',
  girls: MonstGirl[],
  options: { guest?: Guest; trainer?: MonstGirl }
): ServiceSession {
  const girlsStats: Record<string, ParticipantStats> = {}
  for (const g of girls) {
    girlsStats[g.id] = initParticipantStats()
  }
  return {
    type,
    girls,
    messages: [],
    girlsStats,
    guest: options.guest,
    guestStats: options.guest ? initParticipantStats() : undefined,
    trainer: options.trainer,
    trainerStats: options.trainer ? initParticipantStats() : undefined,
  }
}

/**
 * 检查是否有足够好感度的魔物娘可担任调教者
 */
export function findEligibleTrainers(girls: MonstGirl[], excludeId?: string): MonstGirl[] {
  return girls.filter((g) => g.affection >= 60 && g.id !== excludeId)
}

/**
 * 更新满意度（服务场景）
 * satisfactionDelta 直接传入时使用 AI 解析值，否则从 pleasureDelta 推算
 */
export function updateGuestSatisfaction(guest: Guest, pleasureDelta: number, satisfactionDelta?: number): Guest {
  const delta = satisfactionDelta !== undefined ? satisfactionDelta : Math.round(pleasureDelta * 0.6)
  return { ...guest, satisfaction: Math.min(100, Math.max(0, guest.satisfaction + delta)) }
}
