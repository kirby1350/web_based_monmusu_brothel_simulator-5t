import { expandProps, getTemplate } from './custom-props'
import { canPunish } from './incidents'
import { PUNISH_EXTRA_OBEDIENCE, PUNISH_EXTRA_M, PUNISH_M_AFFECTION } from './catalog'
import type { CustomProp, SceneId } from './types'
import {
  getScene, sceneReaction, sceneDecay, hasShadow, provokeBlock, provokeEffect, recentProvokes, deepenShadow, SHADOW_LEVEL_LABEL, usedYesterday, accumulateScene, fetishName, FETISH_THRESHOLD,
  AFFINITY_MAIN_BONUS, AVERSION_MAIN_PENALTY, AVERSION_AFFECTION, SHADOW_AFFECTION, REACTION_LABEL,
} from './scenes'
// 调教结算（纯函数）：驯服 / 放权 / 塑形 / 特训 / 敏感开发
// 基础值 × 调教室倍率；道具、服装是固定小数，不吃倍率；塑形厘米数不吃倍率。
import type { MonstGirl, OutfitId, SensitivityZone, SkillKey, SkillRank, TrainingDirection } from './types'
import {
  SCULPT_POTIONS, SCULPT_BOUNDS, TRAINING_ROOM_MULT, TRAINING_ROOM_PROP_SLOTS,
  SKIP_OBEDIENCE_MIN, TRAINING_PROPS, MAX_STAMINA, COMMON_ZONES, SENSITIVITY_DEFAULT, outfitName,
} from './catalog'
import {
  growProficiency, DRILL_PROF_GAIN, DRILL_PROF_BONUS, MS_PROF_GAIN, MS_PROF_EXTRA, SENSITIZE_PROF_GAIN, ZONE_SKILL,
  type ProfChange,
} from './proficiency'

export const TRAINING_DIRECTIONS: { key: TrainingDirection; label: string; hint: string }[] = [
  { key: 'tame', label: '驯服', hint: '服从 +6，M性 +5' },
  { key: 'release', label: '放权', hint: '淫乱 +6，S性 +5' },
  { key: 'sculpt', label: '塑形', hint: '用一瓶塑形药改三围，淫乱 +1' },
  { key: 'drill', label: '特训', hint: '一项技能熟练度 +10' },
  { key: 'sensitize', label: '敏感开发', hint: '一条敏感带 +10，对应技能 +2' },
  { key: 'punish', label: '惩罚', hint: '驯服效果 + 服从 +3、M性 +3；处理掉事件' },
]

/** 调教体力消耗：每场固定 20（道具、种族、调教室都不改体力） */
export const TRAINING_STAMINA_COST = 20
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
  skill?: SkillKey            // 特训（任何技能都能练）
  zone?: SensitivityZone      // 敏感开发
  scene?: SceneId             // 调教场景（须已拥有且对口方向，由调用方保证）
  day?: number                // 当前天数（场景递减、使用记录用；缺省 1）
  provoke?: SceneId           // 本场被激发的阴影（对话里触到 / 跳过时掷中；由调用方判定）
}

/**
 * m / s / skillProgress 是熟练度的基础增量（递减前）：m→M性、s→S性、skillProgress→profSkill（特训目标，或敏感开发对应的技能）。
 * 实际涨了多少看 TrainingResult.profChanges。
 */
export interface TrainingDelta { obedience: number; lewdness: number; affection: number; m: number; s: number; sensitivity: number; skillProgress: number }

export interface TrainingResult {
  ok: boolean
  error?: string
  delta: TrainingDelta
  measurement?: { stat: 'bust' | 'waist' | 'hip'; from: number; to: number }
  newRank?: SkillRank
  becameTwoSided?: boolean
  /** skillProgress 加到哪项技能 */
  profSkill?: SkillKey
  /** 熟练度实际变化（递减后） */
  profChanges?: ProfChange[]
  staminaCost: number
  girl: MonstGirl   // 应用后的魔物娘
  notes: string[]   // 道具 / 服装 / 种族加成说明
  summary: string
  scene?: SceneId
  direction?: TrainingDirection
  /** 本场让她觉醒的性癖（场景 id） */
  awakenedScene?: SceneId
  /** 本场让她留下阴影的场景 */
  shadowScene?: SceneId
  /** 本场激发了阴影的场景 */
  provokedScene?: SceneId
  /** 公开调教台：声望变化 */
  reputationDelta?: number
}

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
  let profSkill: SkillKey | undefined
  let stamina = TRAINING_STAMINA_COST
  const sceneDef = getScene(input.scene)
  if (input.scene && !sceneDef) return { ok: false, error: '未知的调教场景', delta, staminaCost: 0, girl, notes, summary: '未知的调教场景' }
  if (sceneDef && !sceneDef.directions.includes(direction)) {
    return { ok: false, error: `${sceneDef.name}不适合这个方向`, delta, staminaCost: 0, girl, notes, summary: `${sceneDef.name}不适合这个方向` }
  }
  if (input.provoke) {
    const why = provokeBlock(girl, input.provoke, input.day ?? 1)
    if (why) return { ok: false, error: why, delta, staminaCost: 0, girl, notes, summary: why }
  }
  // 催眠室特训：熟练度 +4
  const sceneProg = input.scene === 'hypnosis' && direction === 'drill' ? DRILL_PROF_BONUS : 0
  const fail = (error: string): TrainingResult => ({ ok: false, error, delta, staminaCost: 0, girl, notes, summary: error })

  switch (direction) {
    case 'tame': {
      let ob = m(6)
      if (skip && girl.obedience < SKIP_OBEDIENCE_MIN) { ob = Math.round(ob * 0.8); notes.push('服从不足 25，跳过的驯服八折') }
      if (props.has('whip')) { ob += 3; notes.push('皮鞭：服从 +3') }
      if (props.has('rack')) { delta.m += MS_PROF_EXTRA; notes.push(`拘束架：M性 +${MS_PROF_EXTRA}`) }
      if (input.outfit === 'restraint' || input.outfit === 'nun') { ob += 1; notes.push(`${outfitName(input.outfit)}：服从 +1`) }
      delta.obedience = ob; delta.m += m(MS_PROF_GAIN); delta.affection = m(1)
      break
    }
    case 'punish': {
      if (!canPunish(girl)) return fail('她没有未处理的事件，不能惩罚')
      // 基础同驯服（乘倍率），额外加成不乘
      let ob = m(6)
      if (props.has('whip')) { ob += 3; notes.push('皮鞭：服从 +3') }
      if (props.has('rack')) { delta.m += MS_PROF_EXTRA; notes.push(`拘束架：M性 +${MS_PROF_EXTRA}`) }
      if (input.outfit === 'restraint') { ob += 1; notes.push(`${outfitName(input.outfit)}：服从 +1`) }
      if (input.outfit === 'harness') { delta.m += MS_PROF_EXTRA; notes.push(`${outfitName(input.outfit)}：M性 +${MS_PROF_EXTRA}`) }
      delta.m += m(MS_PROF_GAIN); delta.affection = m(1)
      if (girl.incident) {
        ob += PUNISH_EXTRA_OBEDIENCE; delta.m += PUNISH_EXTRA_M
        notes.push(`处理事件「${girl.incident.text}」：服从 +${PUNISH_EXTRA_OBEDIENCE}，M性 +${PUNISH_EXTRA_M}`)
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
      if (input.outfit === 'queen' || input.outfit === 'babydoll' || input.outfit === 'latex') { lw += 1; notes.push(`${outfitName(input.outfit)}：淫乱 +1`) }
      delta.lewdness = lw; delta.s = m(MS_PROF_GAIN); delta.affection = m(1)
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
      if (!skill) return fail('需要指定一项技能')
      profSkill = skill
      // 舞娘纱衣：特训「待客」+4，与练习镜不叠加
      const dancerBonus = input.outfit === 'dancer' && skill === '待客' && !props.has('mirror') ? DRILL_PROF_BONUS : 0
      delta.skillProgress = m(DRILL_PROF_GAIN) + (props.has('mirror') ? DRILL_PROF_BONUS : 0) + dancerBonus + sceneProg
      if (sceneProg) notes.push(`催眠室：熟练度 +${DRILL_PROF_BONUS}`)
      if (props.has('mirror')) notes.push(`练习镜：熟练度 +${DRILL_PROF_BONUS}`)
      if (dancerBonus) notes.push(`${outfitName(input.outfit)}：待客熟练度 +${DRILL_PROF_BONUS}`)
      break
    }
    case 'sensitize': {
      const zone = input.zone
      if (!zone) return fail('需要指定一条敏感带')
      let v = m(10)
      const zoneProp = TRAINING_PROPS.find((p) => p.zone === zone && props.has(p.id))
      if (zoneProp) { v += 4; notes.push(`${zoneProp.name}：对口 +4`) }
      if (input.outfit === 'crotchless' && (zone === '阴蒂' || zone === '小穴' || zone === '后庭')) { v += 2; notes.push(`${outfitName(input.outfit)}：+2`) }
      // 兔女郎装→耳朵、吊带泳衣→乳房：+2，已有同部位道具时不叠加
      if (!zoneProp && ((input.outfit === 'bunny' && zone === '耳朵') || (input.outfit === 'sling' && zone === '乳房'))) { v += 2; notes.push(`${outfitName(input.outfit)}：+2`) }
      delta.sensitivity = v
      next.sensitivities = { ...girl.sensitivities, [zone]: clamp100((girl.sensitivities?.[zone] ?? 30) + v) }
      if (ZONE_SKILL[zone]) { profSkill = ZONE_SKILL[zone]; delta.skillProgress = SENSITIZE_PROF_GAIN }
      break
    }
  }

  let sceneOut: { awakenedNow?: boolean; shadowNow?: boolean; rep: number } = { rep: 0 }
  if (sceneDef) {
    const r = applyScene(input, sceneDef.id, next, delta, notes)
    stamina += sceneDef.staminaExtra
    sceneOut = r
  }
  if (input.provoke) {
    const pe = provokeEffect(girl, input.provoke, input.day ?? 1)
    delta.obedience += pe.obedience; stamina += pe.stamina
    notes.push(`激发阴影（${SHADOW_LEVEL_LABEL[pe.level]}·${getScene(input.provoke)!.name}）：服从 +${pe.obedience}，体力 +${pe.stamina}，阴影加深，这一场不长性癖${pe.decay < 1 ? `（本周第 ${recentProvokes(girl, input.day ?? 1) + 1} 次 ×${pe.decay}）` : ''}`)
  }

  // 纯白婚纱内衣：任意方向好感 +1
  if (input.outfit === 'bridal') { delta.affection = (delta.affection ?? 0) + 1; notes.push(`${outfitName(input.outfit)}：好感 +1`) }

  // 不对口的道具不生效
  for (const id of props) if (!notes.some((n) => n.startsWith(PROP_NAME(id)))) notes.push(`${PROP_NAME(id)}：方向不对口，无效果`)

  if (girl.race === '精灵') notes.push('敏感：成长 ×1.25')

  const grown = applyDelta(girl, next, delta, profSkill)
  const newRank = grown.changes.find((c) => c.skill === profSkill && c.rankUp)?.rankUp
  const becameTwoSided = grown.becameTwoSided
  next.stamina = Math.max(0, (girl.stamina ?? MAX_STAMINA) - stamina)
  if (next.stamina === 0) next.exhausted = true
  // 场景使用记录 / 性癖 / 阴影（用结算后的淫乱）
  let awakenedScene: SceneId | undefined, shadowScene: SceneId | undefined, provokedScene: SceneId | undefined
  if (input.provoke) {
    const d = input.day ?? 1
    next.provokedDays = [...(girl.provokedDays ?? []), d].filter((x) => x > d - 7).slice(-7)
    provokedScene = input.provoke
    // 激发的是别处的阴影：那个场景的阴影单独加深
    if (input.provoke !== sceneDef?.id) next.sceneState = deepenShadow(next, input.provoke).sceneState
  }
  if (sceneDef) {
    const acc = accumulateScene(next, sceneDef.id, input.day ?? 1, input.provoke ? (input.provoke === sceneDef.id ? { provoke: true } : { noFetish: true }) : {})
    next.sceneState = acc.girl.sceneState; next.awakened = acc.girl.awakened
    if (acc.awakenedNow) { awakenedScene = sceneDef.id; notes.push(`觉醒性癖「${sceneDef.fetish}」！以后她在${sceneDef.name}里不再抗拒`) }
    else if (acc.fpGain) notes.push(`${sceneDef.fetish}积累 ${Math.min(acc.girl.sceneState?.[sceneDef.id]?.fp ?? 0, FETISH_THRESHOLD)}/${FETISH_THRESHOLD}`)
    if (acc.shadowNow) { shadowScene = sceneDef.id; notes.push(`${sceneDef.name}在她心里留下了阴影`) }
  }
  const label = TRAINING_DIRECTIONS.find((d) => d.key === direction)!.label
  for (let i = 0; i < notes.length; i++) for (const [from, to] of customNames) if (notes[i].startsWith(`${from}：`)) notes[i] = to + notes[i].slice(from.length)
  return {
    ok: true, direction, delta, measurement, newRank, becameTwoSided, profSkill, profChanges: grown.changes, staminaCost: stamina, girl: next, notes,
    summary: trainingSummary(girl.name, sceneDef ? `${sceneDef.name}·${label}` : label, delta, measurement, newRank, grown.changes),
    ...(sceneDef ? { scene: sceneDef.id, reputationDelta: sceneOut.rep } : {}),
    ...(awakenedScene ? { awakenedScene } : {}), ...(shadowScene ? { shadowScene } : {}), ...(provokedScene ? { provokedScene } : {}),
  }
}

/**
 * 场景加成：固定值、不吃倍率；×递减系数；种族亲和/抗拒、觉醒、阴影修正好感与主项。
 * 直接改 delta 与 next（敏感带）；返回声望变化。
 */
function applyScene(input: TrainingInput, id: SceneId, next: MonstGirl, delta: TrainingDelta, notes: string[]): { rep: number } {
  const { girl, direction } = input
  const def = getScene(id)!
  const day = input.day ?? 1
  const decay = sceneDecay(girl, id, day)
  const reaction = sceneReaction(girl, id)
  const holyHalf = id === 'altar' && (input.outfit === 'nun' || input.outfit === 'bridal')
  const k = (n: number) => Math.round(n * decay * (holyHalf ? 0.5 : 1))
  let ob = 0, lw = 0, sens = 0, m = 0, rep = 0
  const extraZones: Partial<Record<SensitivityZone, number>> = {}
  const tameLike = direction === 'tame' || direction === 'punish'
  switch (id) {
    case 'dungeon': ob = k(4); m = MS_PROF_EXTRA; break
    case 'water': ob = k(5) + (direction === 'punish' && girl.incident ? 2 : 0); break
    case 'stage': if (direction === 'tame') { ob = k(4); lw = k(2) } else { lw = k(4); ob = k(2) } rep = 1; break
    case 'machine': if (direction === 'tame') ob = k(6); else sens = k(6); break
    case 'tentacle':
      if (direction === 'tame') { ob = k(8); lw = k(3) }
      else if (direction === 'release') lw = k(8)
      else {
        sens = k(4)
        const others = COMMON_ZONES.filter((z) => z !== input.zone)
        const low = others.reduce((a, z) => ((girl.sensitivities?.[z] ?? SENSITIVITY_DEFAULT) < (girl.sensitivities?.[a] ?? SENSITIVITY_DEFAULT) ? z : a), others[0])
        extraZones[low] = k(3)
      }
      break
    case 'hypnosis': if (direction === 'tame') { ob = k(10); if (usedYesterday(girl, id, day)) { ob = Math.round(ob / 2); notes.push('昨天刚催眠过：服从加成减半') } } break
    case 'altar':
      if (direction === 'release') lw = k(8)
      else for (const z of COMMON_ZONES) if (z !== input.zone) extraZones[z] = k(2)
      break
    case 'onsen': if (direction === 'tame') ob = k(3); else lw = k(3); break
  }
  // 主项：亲和/觉醒 +2，抗拒 −2
  const mainAdj = reaction === 'affinity' || reaction === 'awakened' ? AFFINITY_MAIN_BONUS : reaction === 'aversion' ? -AVERSION_MAIN_PENALTY : 0
  if (mainAdj) {
    if (tameLike) ob = Math.max(0, ob + mainAdj)
    else if (direction === 'release') lw = Math.max(0, lw + mainAdj)
    else if (direction === 'sensitize') sens = Math.max(0, sens + mainAdj)
  }
  // 好感
  let aff = def.affection > 0 ? Math.round(def.affection * decay) : def.affection
  if (reaction === 'awakened') aff = Math.max(0, aff) + 1
  else if (reaction === 'affinity') aff = Math.max(0, aff)
  else if (reaction === 'aversion') aff += AVERSION_AFFECTION
  if (hasShadow(girl, id)) aff += SHADOW_AFFECTION

  delta.obedience += ob; delta.lewdness += lw; delta.m += m; delta.affection += aff
  if (sens && input.zone) {
    delta.sensitivity += sens
    next.sensitivities = { ...next.sensitivities, [input.zone]: clamp100((girl.sensitivities?.[input.zone] ?? SENSITIVITY_DEFAULT) + delta.sensitivity) }
  }
  for (const [z, v] of Object.entries(extraZones)) {
    if (!v) continue
    const zone = z as SensitivityZone
    next.sensitivities = { ...next.sensitivities, [zone]: clamp100((next.sensitivities?.[zone] ?? girl.sensitivities?.[zone] ?? SENSITIVITY_DEFAULT) + v) }
  }

  const gains = [ob && `服从 +${ob}`, lw && `淫乱 +${lw}`, sens && `敏感 +${sens}`, m && `M性 +${m}`,
    Object.keys(extraZones).length && `${Object.entries(extraZones).map(([z, v]) => `${z} +${v}`).join('、')}`, rep && `声望 +${rep}`].filter(Boolean)
  notes.push(`${def.name}：${gains.join('，') || '—'}${aff ? `，好感 ${aff > 0 ? '+' : '−'}${Math.abs(aff)}` : ''}${def.staminaExtra ? `，体力 ${def.staminaExtra > 0 ? '+' : '−'}${Math.abs(def.staminaExtra)}` : ''}`)
  if (decay < 1) notes.push(`本周第 ${countLabel(girl, id, day)} 次用${def.name}：加成 ×${decay}`)
  if (holyHalf) notes.push('圣洁服装与淫纹相冲：加成减半')
  if (reaction !== 'neutral') notes.push(`${REACTION_LABEL[reaction]}（${reaction === 'awakened' ? fetishName(id) : girl.race}）：${reaction === 'aversion' ? '主项 −2、好感 −3' : '主项 +2、不扣好感'}`)
  if (hasShadow(girl, id)) notes.push(`阴影：好感再 −2`)
  return { rep }
}

function countLabel(girl: MonstGirl, id: SceneId, day: number): number {
  return (girl.sceneState?.[id]?.uses ?? []).filter((d) => d > day - 7 && d <= day).length + 1
}

/** 属性直接加；熟练度按递减加（next.proficiency 视为结算前的值），同步倾向 / 两面 */
function applyDelta(girl: MonstGirl, next: MonstGirl, delta: TrainingDelta, profSkill?: SkillKey): { changes: ProfChange[]; becameTwoSided: boolean } {
  next.obedience = clamp100(girl.obedience + delta.obedience)
  next.lewdness = clamp100(girl.lewdness + delta.lewdness)
  next.affection = clamp100(girl.affection + delta.affection)
  const gains: Partial<Record<SkillKey, number>> = {}
  if (delta.m > 0) gains['M性'] = delta.m
  if (delta.s > 0) gains['S性'] = delta.s
  if (profSkill && delta.skillProgress > 0) gains[profSkill] = (gains[profSkill] ?? 0) + delta.skillProgress
  const r = growProficiency(next, gains)
  next.proficiency = r.girl.proficiency
  next.inclination = r.girl.inclination
  return { changes: r.changes, becameTwoSided: r.becameTwoSided }
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
  // 按调整后的 delta 重新应用（塑形三围保持基础结算；熟练度从结算前的值重算）
  const next: MonstGirl = { ...base.girl, proficiency: input.girl.proficiency, inclination: input.girl.inclination }
  const grown = applyDelta(input.girl, next, delta, base.profSkill)
  if (input.direction === 'sensitize' && input.zone) {
    next.sensitivities = { ...base.girl.sensitivities, [input.zone]: clamp100((input.girl.sensitivities?.[input.zone] ?? 30) + delta.sensitivity) }
  }
  const newRank = grown.changes.find((c) => c.skill === base.profSkill && c.rankUp)?.rankUp
  const label = TRAINING_DIRECTIONS.find((d) => d.key === input.direction)!.label
  return {
    ...base, delta, girl: next, notes, newRank, becameTwoSided: grown.becameTwoSided, profChanges: grown.changes,
    summary: trainingSummary(input.girl.name, label, delta, base.measurement, newRank, grown.changes),
  }
}

const STAT_LABEL: [keyof TrainingDelta, string][] = [
  ['obedience', '服从'], ['lewdness', '淫乱'], ['affection', '好感'], ['sensitivity', '敏感度'],
]

export function trainingSummary(name: string, label: string, delta: TrainingDelta, measurement?: TrainingResult['measurement'], newRank?: SkillRank, changes: ProfChange[] = []): string {
  const gains = STAT_LABEL.filter(([k]) => delta[k] > 0).map(([k, l]) => `${l} +${delta[k]}`)
  for (const c of changes) gains.push(`${c.skill}熟练度 ${Math.floor(c.from)}→${Math.floor(c.to)}`)
  if (delta.affection < 0) gains.push(`好感 −${-delta.affection}`)
  const parts = [`${name}在调教室里接受了一轮${label}。`]
  if (measurement) parts.push(`${{ bust: '胸围', waist: '腰围', hip: '臀围' }[measurement.stat]}从 ${measurement.from} 变成了 ${measurement.to}。`)
  if (gains.length) parts.push(`结束时她${gains.join('，')}。`)
  if (newRank) parts.push(`技能提升到了「${newRank}」。`)
  return parts.join('')
}
