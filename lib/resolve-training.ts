import { expandProps, getTemplate } from './custom-props'
import { canPunish } from './incidents'
import { PUNISH_EXTRA_OBEDIENCE, PUNISH_EXTRA_M, PUNISH_M_AFFECTION } from './catalog'
import type { CustomProp } from './types'
// 调教结算（纯函数）：驯服 / 放权 / 塑形 / 特训 / 敏感开发
// 基础值 × 调教室倍率；道具、服装是固定小数，不吃倍率；塑形厘米数不吃倍率。
import type { MonstGirl, OutfitId, SensitivityZone, SkillKey, SkillRank, TrainingDirection } from './types'
import {
  SCULPT_POTIONS, SCULPT_BOUNDS, TRAINING_ROOM_MULT, TRAINING_ROOM_PROP_SLOTS, SKILL_PROGRESS_PER_RANK,
  SKIP_OBEDIENCE_MIN, TRAINING_PROPS, MAX_STAMINA,
} from './catalog'

export const TRAINING_DIRECTIONS: { key: TrainingDirection; label: string; hint: string }[] = [
  { key: 'tame', label: '驯服', hint: '服从 +6，M 进度 +1' },
  { key: 'release', label: '放权', hint: '淫乱 +6，S 进度 +1' },
  { key: 'sculpt', label: '塑形', hint: '用一瓶塑形药改三围，淫乱 +1' },
  { key: 'drill', label: '特训', hint: '已选技能进度 +1' },
  { key: 'sensitize', label: '敏感开发', hint: '一条敏感带 +10' },
  { key: 'punish', label: '惩罚', hint: '驯服效果 + 服从 +3、M 进度 +1；处理掉事件' },
]

/** 调教体力消耗：每场固定 20（道具、种族、调教室都不改体力） */
export const TRAINING_STAMINA_COST = 20
/** 「两面」：服从和淫乱都到 70，且已有 M 性或 S 性 */
export const TWO_SIDED_MIN = 70
export const TWO_SIDED_KEY = '两面'
/** 精灵「敏感」：调教成长 ×1.25（体力不变） */
export const ELF_GROWTH_MULT = 1.25

export interface TrainingInput {
  girl: MonstGirl
  direction: TrainingDirection
  roomLevel?: number
  skip: boolean
  props?: string[]            // 勾选的调教道具（现成 id 或定制 id；须已拥有、不超过槽位，由调用方保证）
  customProps?: CustomProp[]  // 馆主的定制道具（按模板映射成现成道具效果）
  outfit?: OutfitId
  potionId?: string           // 塑形
  skill?: SkillKey | typeof TWO_SIDED_KEY  // 特训
  zone?: SensitivityZone      // 敏感开发
  /** 内部用：亲自上场对特训进度的修正 */
  progressAdjust?: number
}

export interface TrainingDelta { obedience: number; lewdness: number; affection: number; m: number; s: number; sensitivity: number; skillProgress: number }

export interface TrainingResult {
  ok: boolean
  error?: string
  delta: TrainingDelta
  measurement?: { stat: 'bust' | 'waist' | 'hip'; from: number; to: number }
  newRank?: SkillRank
  becameTwoSided?: boolean
  staminaCost: number
  girl: MonstGirl   // 应用后的魔物娘
  notes: string[]   // 道具 / 服装 / 种族加成说明
  summary: string
}

const RANKS: SkillRank[] = ['初学', '熟练', '精通']
const clamp100 = (n: number) => Math.max(0, Math.min(100, n))
const PROP_NAME = (id: string) => TRAINING_PROPS.find((p) => p.id === id)?.name ?? id

export function getTrainingMult(roomLevel?: number): number {
  const lv = Math.max(1, Math.min(4, roomLevel ?? 1))
  return TRAINING_ROOM_MULT[lv - 1]
}
export function getPropSlots(roomLevel?: number): number {
  const lv = Math.max(1, Math.min(4, roomLevel ?? 1))
  return TRAINING_ROOM_PROP_SLOTS[lv - 1]
}

/** 「两面」可练：服从、淫乱都 ≥70，已有 M 性或 S 性，且还不是两面 */
export function canDrillTwoSided(girl: MonstGirl): boolean {
  const inc = girl.inclination ?? '无'
  return (inc === 'M' || inc === 'S') && girl.obedience >= TWO_SIDED_MIN && girl.lewdness >= TWO_SIDED_MIN
}

export function resolveTraining(input: TrainingInput): TrainingResult {
  const { girl, direction, skip } = input
  const props = new Set(expandProps(input.props ?? [], input.customProps))
  // 定制道具：说明文字用定制名（现成道具也勾上时仍用现成名）
  const customNames = new Map<string, string>()
  for (const id of input.props ?? []) {
    const c = input.customProps?.find((x) => x.id === id)
    const base = c && getTemplate(c.templateId)?.baseProp
    if (c && base && !(input.props ?? []).includes(base)) customNames.set(TRAINING_PROPS.find((p) => p.id === base)!.name, c.name)
  }
  const raceMult = girl.race === '精灵' ? ELF_GROWTH_MULT : 1
  const mult = getTrainingMult(input.roomLevel) * raceMult
  const m = (n: number) => Math.round(n * mult)
  const delta: TrainingDelta = { obedience: 0, lewdness: 0, affection: 0, m: 0, s: 0, sensitivity: 0, skillProgress: 0 }
  const notes: string[] = []
  const next: MonstGirl = { ...girl }
  let measurement: TrainingResult['measurement']
  let newRank: SkillRank | undefined
  let becameTwoSided = false
  const stamina = TRAINING_STAMINA_COST
  const fail = (error: string): TrainingResult => ({ ok: false, error, delta, staminaCost: 0, girl, notes, summary: error })

  switch (direction) {
    case 'tame': {
      let ob = m(6)
      if (skip && girl.obedience < SKIP_OBEDIENCE_MIN) { ob = Math.round(ob * 0.8); notes.push('服从不足 25，跳过的驯服八折') }
      if (props.has('whip')) { ob += 3; notes.push('皮鞭：服从 +3') }
      if (props.has('rack')) { delta.m += 1; notes.push('拘束架：M 进度 +1') }
      if (input.outfit === 'restraint') { ob += 1; notes.push('拘束衣：服从 +1') }
      delta.obedience = ob; delta.m += m(1); delta.affection = m(1)
      break
    }
    case 'punish': {
      if (!canPunish(girl)) return fail('她没有未处理的事件，不能惩罚')
      // 基础同驯服（乘倍率），额外加成不乘
      let ob = m(6)
      if (props.has('whip')) { ob += 3; notes.push('皮鞭：服从 +3') }
      if (props.has('rack')) { delta.m += 1; notes.push('拘束架：M 进度 +1') }
      if (input.outfit === 'restraint') { ob += 1; notes.push('拘束衣：服从 +1') }
      delta.m += m(1); delta.affection = m(1)
      if (girl.incident) {
        ob += PUNISH_EXTRA_OBEDIENCE; delta.m += PUNISH_EXTRA_M
        notes.push(`处理事件「${girl.incident.text}」：服从 +${PUNISH_EXTRA_OBEDIENCE}，M 进度 +${PUNISH_EXTRA_M}`)
        next.incident = null
      } else {
        delta.affection += PUNISH_M_AFFECTION
        notes.push(`M 性：渴望被惩罚，好感 +${PUNISH_M_AFFECTION}`)
      }
      delta.obedience = ob
      break
    }
    case 'release': {
      let lw = m(6)
      if (props.has('massage_table')) { lw += 3; notes.push('按摩台：淫乱 +3') }
      if (props.has('censer')) { lw += 2; notes.push('香炉：淫乱 +2') }
      if (input.outfit === 'queen') { lw += 1; notes.push('女王装：淫乱 +1') }
      delta.lewdness = lw; delta.s = m(1); delta.affection = m(1)
      break
    }
    case 'sculpt': {
      const potion = SCULPT_POTIONS.find((p) => p.id === input.potionId)
      if (!potion) return fail('需要指定一瓶塑形药')
      const [lo, hi] = SCULPT_BOUNDS[potion.stat]
      const from = girl[potion.stat]
      // 厘米数不吃倍率；魔女「调剂」药效 ×1.5；塑形架让胸围或臀围再多 1 厘米
      let cm = girl.race === '魔女' ? Math.round(potion.delta * 1.5) : potion.delta
      if (girl.race === '魔女') notes.push('调剂：药效提高五成')
      if (props.has('sculpt_frame') && potion.stat !== 'waist') { cm += Math.sign(potion.delta); notes.push('塑形架：再多 1 厘米') }
      const to = Math.max(lo, Math.min(hi, from + cm))
      next[potion.stat] = to
      measurement = { stat: potion.stat, from, to }
      const counts = girl.sculptCounts ?? { bust: 0, waist: 0, hip: 0 }
      next.sculptCounts = { ...counts, [potion.stat]: counts[potion.stat] + 1 }
      let lw = m(1)
      if (props.has('censer')) { lw += 2; notes.push('香炉：淫乱 +2') }
      delta.lewdness = lw
      break
    }
    case 'drill': {
      const skill = input.skill
      if (skill === TWO_SIDED_KEY) {
        if (!canDrillTwoSided(girl)) return fail('服从和淫乱都到 70、且已有 M 性或 S 性才能练「两面」')
        next.inclination = '两面'
        becameTwoSided = true
        delta.skillProgress = 1
        break
      }
      const rank = skill ? girl.skillRanks?.[skill] : undefined
      if (!skill || !rank) return fail('只能特训已选的技能')
      delta.skillProgress = Math.max(0, m(1) + (props.has('mirror') ? 1 : 0) + (input.progressAdjust ?? 0))
      if (props.has('mirror')) notes.push('练习镜：进度 +1')
      const prog = (girl.skillProgress?.[skill] ?? 0) + delta.skillProgress
      let idx = RANKS.indexOf(rank)
      let rest = prog
      while (idx < RANKS.length - 1 && rest >= SKILL_PROGRESS_PER_RANK) { idx++; rest -= SKILL_PROGRESS_PER_RANK }
      if (idx === RANKS.length - 1) rest = 0
      next.skillRanks = { ...girl.skillRanks, [skill]: RANKS[idx] }
      next.skillProgress = { ...girl.skillProgress, [skill]: rest }
      if (RANKS[idx] !== rank) newRank = RANKS[idx]
      break
    }
    case 'sensitize': {
      const zone = input.zone
      if (!zone) return fail('需要指定一条敏感带')
      let v = m(10)
      const zoneProp = TRAINING_PROPS.find((p) => p.zone === zone && props.has(p.id))
      if (zoneProp) { v += 4; notes.push(`${zoneProp.name}：对口 +4`) }
      if (input.outfit === 'crotchless' && (zone === '阴蒂' || zone === '小穴' || zone === '后庭')) { v += 2; notes.push('开裆装：+2') }
      delta.sensitivity = v
      next.sensitivities = { ...girl.sensitivities, [zone]: clamp100((girl.sensitivities?.[zone] ?? 30) + v) }
      break
    }
  }

  // 不对口的道具不生效
  for (const id of props) if (!notes.some((n) => n.startsWith(PROP_NAME(id)))) notes.push(`${PROP_NAME(id)}：方向不对口，无效果`)

  if (girl.race === '精灵') notes.push('敏感：成长 ×1.25')

  applyDelta(girl, next, delta)
  next.stamina = Math.max(0, (girl.stamina ?? MAX_STAMINA) - stamina)
  if (next.stamina === 0) next.exhausted = true
  const label = TRAINING_DIRECTIONS.find((d) => d.key === direction)!.label
  for (let i = 0; i < notes.length; i++) for (const [from, to] of customNames) if (notes[i].startsWith(`${from}：`)) notes[i] = to + notes[i].slice(from.length)
  return { ok: true, delta, measurement, newRank, becameTwoSided, staminaCost: stamina, girl: next, notes, summary: trainingSummary(girl.name, label, delta, measurement, newRank) }
}

function applyDelta(girl: MonstGirl, next: MonstGirl, delta: TrainingDelta) {
  next.obedience = clamp100(girl.obedience + delta.obedience)
  next.lewdness = clamp100(girl.lewdness + delta.lewdness)
  next.affection = clamp100(girl.affection + delta.affection)
  if (delta.m || delta.s) {
    const p = girl.msProgress ?? { m: 0, s: 0 }
    next.msProgress = { m: p.m + delta.m, s: p.s + delta.s }
  }
}

const MAIN_KEY: Record<TrainingDirection, keyof TrainingDelta> = {
  tame: 'obedience', release: 'lewdness', sculpt: 'lewdness', drill: 'skillProgress', sensitize: 'sensitivity', punish: 'obedience',
}

/**
 * 亲自上场：保底同一份数值；回合多（≥6）且快感高（≥60）主项再 +2；
 * 只写一两句（≤2 回合）就结束，则数值只拿一半（塑形厘米数照常）。
 */
export function resolveLiveTraining(input: Omit<TrainingInput, 'skip'>, turns: number, pleasure: number): TrainingResult {
  const base = resolveTraining({ ...input, skip: false })
  if (!base.ok) return base
  const key = MAIN_KEY[input.direction]
  let delta = { ...base.delta }
  const notes = [...base.notes]
  if (turns <= 2) {
    delta = Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, Math.floor(v / 2)])) as unknown as TrainingDelta
    notes.push('只写了一两句，成长减半')
  } else if (turns >= 6 && pleasure >= 60) {
    delta[key] += 2
    notes.push('回合多、快感高，主项 +2')
  }
  if (delta === base.delta) return base
  // 按调整后的 delta 重新应用（塑形三围、技能档位保持基础结算）
  const next: MonstGirl = { ...base.girl }
  applyDelta(input.girl, next, delta)
  if (input.direction === 'sensitize' && input.zone) {
    next.sensitivities = { ...base.girl.sensitivities, [input.zone]: clamp100((input.girl.sensitivities?.[input.zone] ?? 30) + delta.sensitivity) }
  }
  if (input.direction === 'drill' && input.skill !== TWO_SIDED_KEY) {
    const r = resolveTraining({ ...input, skip: false, progressAdjust: delta.skillProgress - base.delta.skillProgress })
    return { ...r, notes }
  }
  const label = TRAINING_DIRECTIONS.find((d) => d.key === input.direction)!.label
  return { ...base, delta, girl: next, notes, summary: trainingSummary(input.girl.name, label, delta, base.measurement, base.newRank) }
}

const STAT_LABEL: [keyof TrainingDelta, string][] = [
  ['obedience', '服从'], ['lewdness', '淫乱'], ['affection', '好感'], ['sensitivity', '敏感度'], ['skillProgress', '技能进度'],
]

export function trainingSummary(name: string, label: string, delta: TrainingDelta, measurement?: TrainingResult['measurement'], newRank?: SkillRank): string {
  const gains = STAT_LABEL.filter(([k]) => delta[k] > 0).map(([k, l]) => `${l} +${delta[k]}`)
  const parts = [`${name}在调教室里接受了一轮${label}。`]
  if (measurement) parts.push(`${{ bust: '胸围', waist: '腰围', hip: '臀围' }[measurement.stat]}从 ${measurement.from} 变成了 ${measurement.to}。`)
  if (gains.length) parts.push(`结束时她${gains.join('，')}。`)
  if (newRank) parts.push(`技能提升到了「${newRank}」。`)
  return parts.join('')
}
