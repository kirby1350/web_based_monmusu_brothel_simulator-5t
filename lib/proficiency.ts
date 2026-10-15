// 技能熟练度（UX 8）：口侍 / 胸侍 / 身侍 / 手技 / 待客 / M性 / S性 各一条 0–100 的条，
// 按 25 / 50 / 75 分档（未学 / 初学 / 熟练 / 精通），数值作用全部按档，沿用旧的档位表。
// 只依赖 types，catalog / 结算 / 迁移都从这里取。
import type { Inclination, MonstGirl, SensitivityZone, ServingSkill, SkillKey, SkillRank } from './types'

export const SERVING_PROF_SKILLS: ServingSkill[] = ['口侍', '胸侍', '身侍', '手技', '待客']
export const PROF_SKILLS: SkillKey[] = [...SERVING_PROF_SKILLS, 'M性', 'S性']
export type Proficiency = Partial<Record<SkillKey, number>>

/** 分档门槛：≥25 初学、≥50 熟练、≥75 精通 */
export const PROF_TIERS: Record<SkillRank, number> = { 初学: 25, 熟练: 50, 精通: 75 }
export const PROF_MAX = 100

// 初始值
export const PROF_BASE = 10
export const PROF_INIT_CAP = 45
/** 开局最多几项服侍技能达到初学 */
export const PROF_INIT_MAX_LEARNED = 3
/** 种族加成（开局一次） */
export const RACE_PROF_BONUS: Record<string, Proficiency> = {
  牛娘: { 胸侍: 15 }, 狐娘: { 待客: 12 }, 吸血鬼: { 口侍: 12 }, 兔娘: { 身侍: 10 }, 魔女: { 手技: 10 },
  黑暗精灵: { S性: 10 }, 犬娘: { M性: 12 }, 龙娘: { S性: 12 },
  拉米亚: { 身侍: 8 }, 史莱姆: { 身侍: 8 }, 鬼娘: { 身侍: 8 }, 狼娘: { 身侍: 8 },
  猫娘: { 口侍: 8 }, 精灵: { 手技: 8 }, 蜘蛛娘: { 手技: 8 }, 哈比: { 待客: 8 },
}

// 增长
/** 接客：正戏主服务 +2；迎客→待客、前戏→手技、每个额外 play→来源技能 各 +1 */
export const SERVICE_PROF_MAIN = 2
export const SERVICE_PROF_SIDE = 1
/** 亲自上场 ×1.5 */
export const SERVICE_PROF_LIVE_MULT = 1.5
/** 接客最多练到 74（熟练封顶），精通要靠特训 */
export const SERVICE_PROF_CAP = 74
/** 特训 +16（乘调教室倍率）；练习镜 / 舞娘装（待客）/ 催眠室 各 +6 */
export const DRILL_PROF_GAIN = 16
export const DRILL_PROF_BONUS = 6
/** 驯服 / 惩罚 M性 +8、放权 S性 +8（乘倍率）；拘束道具 / 惩罚事件 / 地牢等各 +4 */
export const MS_PROF_GAIN = 8
export const MS_PROF_EXTRA = 4
/** 敏感开发：对应部位的技能 +5 */
export const SENSITIZE_PROF_GAIN = 5
export const ZONE_SKILL: Partial<Record<SensitivityZone, ServingSkill>> = { 唇舌: '口侍', 乳房: '胸侍', 小穴: '身侍', 阴蒂: '手技' }
/** 两面：M性、S性都 ≥50，且服从、淫乱都 ≥70 时自动成为两面 */
export const TWO_SIDED_PROF = 50
export const TWO_SIDED_STAT = 70

/** 递减（接客）：<50 ×1、50–74 ×0.6、≥75 ×0.3 */
export function profDim(v: number): number { return v < PROF_TIERS.熟练 ? 1 : v < PROF_TIERS.精通 ? 0.6 : 0.3 }
/** 递减（调教）：专门练比接客顺手得多——<50 ×1、50–74 ×0.85、≥75 ×0.5 */
export const TRAIN_DIM: [number, number, number] = [1, 0.8, 0.4]
export function profDimTraining(v: number): number { return v < PROF_TIERS.熟练 ? TRAIN_DIM[0] : v < PROF_TIERS.精通 ? TRAIN_DIM[1] : TRAIN_DIM[2] }

export function profRank(v: number | undefined): SkillRank | undefined {
  if (v === undefined || v < PROF_TIERS.初学) return undefined
  return v >= PROF_TIERS.精通 ? '精通' : v >= PROF_TIERS.熟练 ? '熟练' : '初学'
}
export function profTierLabel(v: number | undefined): SkillRank | '未学' { return profRank(v) ?? '未学' }
/** 下一档门槛（已精通返回 undefined） */
export function nextTier(v: number): { rank: SkillRank; at: number } | undefined {
  for (const r of ['初学', '熟练', '精通'] as SkillRank[]) if (v < PROF_TIERS[r]) return { rank: r, at: PROF_TIERS[r] }
  return undefined
}
export const profShow = (v: number | undefined) => Math.floor(v ?? 0)

const bustLv = (g: Pick<MonstGirl, 'bust'>) => Math.max(0, Math.min(6, Math.floor(((g.bust ?? 0) - 85) / 5)))
const hipLv = (g: Pick<MonstGirl, 'hip'>) => Math.max(0, Math.min(5, Math.floor(((g.hip ?? 0) - 88) / 5)))

type InitInput = Pick<MonstGirl, 'race' | 'affection' | 'obedience' | 'lewdness' | 'bust' | 'hip'>

/** 新魔物娘的初始熟练度：属性 + 三围 + 种族；每项 ≤45，最多 3 项服侍技能 ≥25 */
export function initialProficiency(g: InitInput): Required<Proficiency> {
  const L = Math.floor((g.lewdness ?? 0) / 4)
  const p: Required<Proficiency> = {
    口侍: PROF_BASE + L,
    胸侍: PROF_BASE + L + bustLv(g) * 3,
    身侍: PROF_BASE + L + hipLv(g) * 2,
    手技: PROF_BASE + L,
    待客: PROF_BASE + Math.floor((g.affection ?? 0) / 4),
    M性: Math.floor((g.obedience ?? 0) / 4),
    S性: Math.floor((g.lewdness ?? 0) / 6),
  }
  for (const [k, v] of Object.entries(RACE_PROF_BONUS[g.race] ?? {})) p[k as SkillKey] += v ?? 0
  for (const k of PROF_SKILLS) p[k] = Math.max(0, Math.min(PROF_INIT_CAP, p[k]))
  const order = [...SERVING_PROF_SKILLS].sort((a, b) => p[b] - p[a] || SERVING_PROF_SKILLS.indexOf(a) - SERVING_PROF_SKILLS.indexOf(b))
  for (const k of order.slice(PROF_INIT_MAX_LEARNED)) p[k] = Math.min(PROF_TIERS.初学 - 1, p[k])
  return p
}

/** 倾向由两条条推出：M性 ≥25 且 ≥ S性 → M；S性 ≥25 → S；否则无。已是两面的保持两面 */
export function deriveInclination(g: Pick<MonstGirl, 'proficiency' | 'inclination'>): Inclination {
  if (g.inclination === '两面') return '两面'
  const m = g.proficiency?.['M性'] ?? 0, s = g.proficiency?.['S性'] ?? 0
  if (m >= PROF_TIERS.初学 && m >= s) return 'M'
  if (s >= PROF_TIERS.初学) return 'S'
  return '无'
}

export function canBecomeTwoSided(g: MonstGirl): boolean {
  const p = g.proficiency ?? {}
  return g.inclination !== '两面' && (p['M性'] ?? 0) >= TWO_SIDED_PROF && (p['S性'] ?? 0) >= TWO_SIDED_PROF
    && g.obedience >= TWO_SIDED_STAT && g.lewdness >= TWO_SIDED_STAT
}

export interface ProfChange { skill: SkillKey; from: number; to: number; rankUp?: SkillRank }

/** 按递减系数加熟练度（cap 以上不涨）；保留一位小数 */
export function addProf(cur: number, base: number, cap = PROF_MAX, dim: (v: number) => number = profDim): number {
  if (base <= 0 || cur >= cap) return cur
  return Math.min(cap, Math.round((cur + base * dim(cur)) * 10) / 10)
}

/**
 * 给一个魔物娘加一批熟练度（base 是递减前的基础值），同步倾向并检查两面。
 * 没有 proficiency 的旧对象先按旧档位换算（与迁移一致）。
 */
export function growProficiency(girl: MonstGirl, gains: Proficiency, cap = PROF_MAX, dim: (v: number) => number = profDim): { girl: MonstGirl; changes: ProfChange[]; becameTwoSided: boolean } {
  const cur: Proficiency = { ...(girl.proficiency ?? proficiencyFromLegacy(girl)) }
  const changes: ProfChange[] = []
  for (const k of PROF_SKILLS) {
    const base = gains[k]
    if (!base) continue
    const from = cur[k] ?? 0
    const to = addProf(from, base, cap, dim)
    if (to === from) continue
    cur[k] = to
    const before = profRank(from), after = profRank(to)
    changes.push({ skill: k, from, to, ...(after && after !== before ? { rankUp: after } : {}) })
  }
  let next: MonstGirl = { ...girl, proficiency: cur }
  next.inclination = deriveInclination(next)
  let becameTwoSided = false
  if (canBecomeTwoSided(next)) { next = { ...next, inclination: '两面' }; becameTwoSided = true }
  return { girl: next, changes, becameTwoSided }
}

/** 新魔物娘入馆：补初始熟练度与倾向（已有则不动） */
export function withInitialProficiency<T extends MonstGirl>(g: T): T {
  if (g.proficiency) return g
  const proficiency = initialProficiency(g)
  return { ...g, proficiency, inclination: deriveInclination({ proficiency, inclination: g.inclination }) }
}

// ─── 旧存档迁移 ───────────────────────────────────────────────────────────────
/** 旧档位 → 熟练度：初学 30 / 熟练 55 / 精通 80；旧特训进度每点 +5（不跨档） */
export const LEGACY_RANK_PROF: Record<SkillRank, number> = { 初学: 30, 熟练: 55, 精通: 80 }

/**
 * 旧存档 → 熟练度。保证迁移前后接客得分一样：
 * - 学过的技能档位不变；没学过的压到 24（牛娘胸侍按旧特判算初学 30）；
 * - M/S：旧进度 ×5 与旧档位换算取大；倾向保持不变（旧「无」两侧都压到 24，旧 M/S 另一侧压到比它低）。
 */
export function proficiencyFromLegacy(g: MonstGirl): Required<Proficiency> {
  const init = initialProficiency(g)
  const ranks = g.skillRanks ?? {}
  const prog = g.skillProgress ?? {}
  const p = { ...init }
  for (const k of SERVING_PROF_SKILLS) {
    const r = ranks[k] ?? (k === '胸侍' && g.race === '牛娘' ? '初学' : undefined)
    if (r) {
      const base = LEGACY_RANK_PROF[r]
      const ceil = r === '精通' ? PROF_MAX : r === '熟练' ? PROF_TIERS.精通 - 1 : PROF_TIERS.熟练 - 1
      p[k] = Math.min(ceil, base + (prog[k] ?? 0) * 5)
    } else p[k] = Math.min(PROF_TIERS.初学 - 1, init[k])
  }
  const ms = g.msProgress ?? { m: 0, s: 0 }
  const side = (k: 'M性' | 'S性', raw: number) => {
    const r = ranks[k]
    const v = Math.max(raw * 5, r ? LEGACY_RANK_PROF[r] : 0)
    // 有档位的不跨档（旧 play 档位不变）；没档位的按初学算（旧 scorePlay 缺省初学）
    const ceil = r === '精通' ? PROF_MAX : r === '熟练' ? PROF_TIERS.精通 - 1 : PROF_TIERS.熟练 - 1
    return Math.min(ceil, v)
  }
  let m = side('M性', ms.m), s = side('S性', ms.s)
  const inc = g.inclination ?? '无'
  if (inc === '无') { m = Math.min(m, PROF_TIERS.初学 - 1); s = Math.min(s, PROF_TIERS.初学 - 1) }
  else if (inc === 'M') { m = Math.max(m, PROF_TIERS.初学); s = Math.min(s, m - 1) }
  else if (inc === 'S') { s = Math.max(s, PROF_TIERS.初学); m = Math.min(m, s - 1, PROF_TIERS.初学 - 1) }
  else { m = Math.max(m, PROF_TIERS.初学); s = Math.max(s, PROF_TIERS.初学) }
  p['M性'] = m; p['S性'] = s
  return p
}

/** 卡片上的「拿手」简述：入门以上的服侍技能按熟练度排序取前 n 项，例如「胸侍 初学45 · 待客 初学33」；都没入门写「暂无拿手技能」 */
export function topSkillsText(g: MonstGirl, n = 2): string {
  const p = g.proficiency ?? initialProficiency(g)
  const top = [...SERVING_PROF_SKILLS].filter((k) => (p[k] ?? 0) >= PROF_TIERS.初学)
    .sort((a, b) => (p[b] ?? 0) - (p[a] ?? 0)).slice(0, n)
  return top.length ? top.map((k) => `${k} ${profTierLabel(p[k])}${profShow(p[k])}`).join(' · ') : '暂无拿手技能'
}
