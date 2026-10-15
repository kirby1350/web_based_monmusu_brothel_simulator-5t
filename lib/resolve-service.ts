// 接客结算（纯函数）：五步标准流程 + 额外 play → 满意度 / 档位 / 收入 / 体力
import { fetishMatchesGuest, fetishName, FETISH_GREET_BONUS } from './scenes'
import { regularBonus } from './girl-memory'
import { SERVICE_PROF_MAIN, SERVICE_PROF_SIDE, SERVICE_PROF_LIVE_MULT, type Proficiency } from './proficiency'
import type { Guest, MonstGirl, OutfitId, SensitivityZone, ServingSkill, SkillRank, StockingId } from './types'
import {
  GREET_HOSTING_SCORE, STEP_SCORE, STEP_MAX, SKILL_RANK_BONUS, PLAY_SCORE, PLAYS, RACE_PLAYS, SKIP_MATCH_BONUS, racePlayMatched, PlayDef, WRONG_SIDE_PLAY_PENALTY,
  OUTFITS, STOCKINGS, RACE_TRAITS, getPlaySlots, getGuestProfile, getSkillRank, getInclination,
  getSensitivityLevel, SENSITIVITY_STEP_MOD, SENSITIVITY_STAMINA_MOD, SKIP_SERVICE_STAMINA,
  SKIP_OBEDIENCE_MIN, DRAGON_SKIP_OBEDIENCE_MULT, ANAL_UNLOCK, OUTFIT_GREET_BONUS, OUTFIT_GREET_MISMATCH,
} from './catalog'
import { getSatisfactionTier, calcServiceReward, type SatisfactionTier } from './game-engine'

export type ServiceStepKey = 'greet' | 'tease' | 'foreplay' | 'main' | 'cleanup'
export const SERVICE_STEPS: { key: ServiceStepKey; label: string }[] = [
  { key: 'greet', label: '迎客' },
  { key: 'tease', label: '挑逗' },
  { key: 'foreplay', label: '前戏' },
  { key: 'main', label: '正戏' },
  { key: 'cleanup', label: '清洗' },
]

export interface ServiceInput {
  girl: MonstGirl
  guest: Guest
  roomLevel?: number
  outfit?: OutfitId
  stockings?: StockingId
  /** 手选 play id；跳过时缺省自动填最对口的 */
  plays?: string[]
  skip: boolean
  /** 当天全馆已进行的场次（黑暗精灵「夜习」：第 2、3 场额外满意度） */
  sessionIndexToday?: number
  /** 她今天已出场的次数（兔娘「持久」：第二场体力消耗减轻） */
  girlSessionsToday?: number
}

export interface StepResult { key: ServiceStepKey; label: string; score: number; zone?: SensitivityZone; note?: string }
export interface PlayResult { id: string; name: string; score: number; matched: boolean; rank: SkillRank; zone?: SensitivityZone }

export interface ServiceResult {
  /** 这一场给熟练度的基础增量（递减前）：主服务 +2、待客 / 手技 / 每个额外 play 来源 +1；亲自上场 ×1.5 */
  profGains: Proficiency
  /** 写进关系记忆的要点行 */
  memoryDetail?: string
  canSkip: boolean
  steps: StepResult[]
  standardScore: number
  plays: PlayResult[]
  playScore: number
  outfitMatched: boolean
  satisfaction: number
  tier: SatisfactionTier
  reward: number
  staminaCost: number
  /** 体力修正明细：最终消耗 = round((基础 + extra) × mult) − refund（refund 只在满意及以上） */
  staminaExtra: number
  staminaMult: number
  staminaRefund: number
  /** 跳过结算的匹配加成（已算进 satisfaction；亲自上场为 0，亲自上场按投入度另算 liveMatch） */
  matchBonus: number
  /** 不带 70 保护的匹配加成全额（主类型 / 对口 play / 服装），给亲自上场按投入度折算 */
  matchPotential: number
  matchParts: string[]
  /** 种族特技带来的满意度加成（已算进 satisfaction） */
  satisfactionBonus: number
  raceNotes: string[]
  affectionDelta: number
  summary: string
  /** 多人服务：默契加成（已算进 satisfaction）、明细、每位协同的体力消耗 */
  synergy?: number
  synergyParts?: string[]
  partnerStamina?: Record<string, number>
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

/** 数值（服从/淫乱）折成步骤档：<25 无，<50 初学，<75 熟练，否则精通 */
function statToRank(v: number): SkillRank | '无' {
  if (v >= 75) return '精通'
  if (v >= 50) return '熟练'
  if (v >= 25) return '初学'
  return '无'
}

const clampStep = (n: number) => Math.max(0, Math.min(STEP_MAX, n))

function zoneMod(girl: MonstGirl, zone?: SensitivityZone): number {
  if (!zone) return 0
  const v = girl.sensitivities?.[zone]
  return v === undefined ? 0 : SENSITIVITY_STEP_MOD[getSensitivityLevel(v)]
}

const MAIN_ZONE: Record<'口侍' | '胸侍' | '身侍', SensitivityZone> = { 口侍: '唇舌', 胸侍: '乳房', 身侍: '小穴' }

function bustBonus(girl: MonstGirl) { return Math.max(0, Math.min(6, Math.floor(((girl.bust ?? 0) - 85) / 5))) }
function hipBonus(girl: MonstGirl) { return Math.max(0, Math.min(5, Math.floor(((girl.hip ?? 0) - 88) / 5))) }

const BEAST_RACES = ['猫娘', '犬娘', '狐娘', '兔娘', '牛娘', '狼娘']

export function traitMatched(guest: Guest, girl: MonstGirl): boolean {
  switch (guest.prefTrait) {
    case '巨乳': return (girl.bust ?? 0) >= 95
    case '贫乳': return (girl.bust ?? 0) > 0 && (girl.bust ?? 0) <= 82
    case '丰臀': return (girl.hip ?? 0) >= 95
    case '兽耳': return BEAST_RACES.includes(girl.race)
    default: return false
  }
}

/** 服从门槛：低于 25 不能跳过，犬娘「忠犬」除外 */
export function canSkipService(girl: MonstGirl): boolean {
  return girl.race === '犬娘' || girl.obedience >= SKIP_OBEDIENCE_MIN
}

/** 正戏主类型：按客人主需求选口侍/胸侍/身侍（种族需求落在身侍） */
export function getMainService(guest: Guest): '口侍' | '胸侍' | '身侍' {
  const s = getGuestProfile(guest).service
  return s === '口侍' || s === '胸侍' ? s : '身侍'
}

// ─── play ─────────────────────────────────────────────────────────────────────

/** 她能选的 play（已会技能 / M·S / 本种族专属 play），正戏占用的主类型除外 */
export function getAvailablePlays(girl: MonstGirl, guest: Guest): PlayDef[] {
  const main = getMainService(guest)
  const inc = getInclination(girl)
  return [...PLAYS, ...(RACE_PLAYS[girl.race] ?? [])].filter((p) => {
    if (p.source === main) return false
    if (p.source === 'race') return p.race === girl.race
    if (p.source === 'M性') return inc === '两面' || (inc === 'M' && !!getSkillRank(girl, 'M性'))
    if (p.source === 'S性') return inc === '两面' || (inc === 'S' && !!getSkillRank(girl, 'S性'))
    if (p.id === 'paizuri' && (girl.bust ?? 0) < 80) return false
    return !!getSkillRank(girl, p.source)
  }).filter((p) => p.zone !== '后庭' || (girl.sensitivities?.['后庭'] ?? 0) >= ANAL_UNLOCK)
}

export function scorePlay(girl: MonstGirl, guest: Guest, play: PlayDef): PlayResult {
  const profile = getGuestProfile(guest)
  const inc = getInclination(girl)
  let rank: SkillRank
  let matched: boolean
  let score: number
  if (play.source === 'M性' || play.source === 'S性') {
    const side = play.source === 'M性' ? 'M' : 'S'
    rank = inc === '两面' ? '熟练' : (getSkillRank(girl, play.source) ?? '初学')
    matched = profile.kind === side
    const wrongSide = profile.kind !== '中性' && profile.kind !== side
    score = wrongSide ? WRONG_SIDE_PLAY_PENALTY : matched ? PLAY_SCORE[rank] : Math.floor(PLAY_SCORE[rank] / 2)
  } else {
    if (play.source === 'race') {
      rank = play.rank ?? '熟练'
      matched = racePlayMatched(play, guest)
    } else {
      rank = getSkillRank(girl, play.source) ?? '初学'
      matched = profile.service === play.source || profile.secondary.includes(play.source as ServingSkill)
    }
    score = matched ? PLAY_SCORE[rank] : Math.floor(PLAY_SCORE[rank] / 2)
    if (play.id === 'paizuri') score += bustBonus(girl)
    if (play.id === 'positions') score += hipBonus(girl) + (girl.race === '哈比' && matched ? 2 : 0)
  }
  if (score > 0) score += zoneMod(girl, play.zone)
  const name = play.name
  return { id: play.id, name, score, matched, rank, zone: play.zone }
}

/** 自动填最对口的 play，直到槽位用完（不填负分 play） */
export function autoPickPlays(girl: MonstGirl, guest: Guest, slots: number): string[] {
  return getAvailablePlays(girl, guest)
    .map((p) => scorePlay(girl, guest, p))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, slots)
    .map((r) => r.id)
}

/** 技能档对口加成（熟练 +5 / 精通 +9） */
export function skillRankBonus(girl: MonstGirl, main: ServingSkill): { total: number; notes: string[] } {
  const notes: string[] = []
  let total = 0
  for (const [step, skill] of [['迎客', '待客'], ['前戏', '手技'], ['正戏', main]] as const) {
    const r = getSkillRank(girl, skill)
    const b = r ? SKILL_RANK_BONUS[r] : 0
    if (b) { total += b; notes.push(`${step}·${skill}${r}：满意度 +${b}`) }
  }
  return { total, notes }
}

/** 精通特权「游刃有余」：该技能对应的步骤直接满分，不受低体力、迟钝敏感带拖累 */
export function masteryFullSteps(steps: StepResult[], girl: MonstGirl, main: ServingSkill, notes: string[]): StepResult[] {
  const skillOf: Record<string, ServingSkill> = { greet: '待客', foreplay: '手技', main }
  return steps.map((st) => {
    const k = skillOf[st.key]
    if (!k || getSkillRank(girl, k) !== '精通' || st.score >= STEP_MAX) return st
    notes.push(`游刃有余：${st.label}·${k}精通，此步满分`)
    return { ...st, score: STEP_MAX }
  })
}

// ─── 主结算 ───────────────────────────────────────────────────────────────────

export function resolveService(input: ServiceInput): ServiceResult {
  const { girl, guest, skip } = input
  const outfit = input.outfit ?? 'regular'
  const stockings = input.stockings ?? 'none'
  const main = getMainService(guest)
  const slots = getPlaySlots(input.roomLevel)
  const obedience = skip && girl.race === '龙娘' ? Math.floor(girl.obedience * DRAGON_SKIP_OBEDIENCE_MULT) : girl.obedience

  // 迎客
  const outfitPref = OUTFITS.find((o) => o.id === outfit)?.pref ?? null
  const stockingPref = STOCKINGS.find((s) => s.id === stockings)?.pref ?? null
  const outfitMatched = !!guest.prefOutfit && (outfitPref === guest.prefOutfit || stockingPref === guest.prefOutfit)
  let greet = GREET_HOSTING_SCORE[getSkillRank(girl, '待客') ?? '无']
  const raceNotes: string[] = []
  const raceHit = !!guest.prefRace && guest.prefRace === girl.race
  const traitHit = traitMatched(guest, girl)
  if (raceHit) greet += 2
  if (traitHit) greet += 2
  if (outfitMatched) greet += OUTFIT_GREET_BONUS
  else if (guest.prefOutfit && outfit !== 'regular') greet += OUTFIT_GREET_MISMATCH
  // 后天觉醒的性癖对上客人口味：迎客 +2（单场一次）
  const fetishHit = (girl.awakened ?? []).find((id) => fetishMatchesGuest(id, guest))
  if (fetishHit) { greet += FETISH_GREET_BONUS; raceNotes.push(`性癖「${fetishName(fetishHit)}」对上客人口味：迎客 +${FETISH_GREET_BONUS}`) }
  // 她记得的熟客（接过 ≥3 次、最好一次 ≥70）：迎客 +2
  const regular = regularBonus(girl, guest)
  if (regular) { greet += regular; raceNotes.push(`熟客：她记得${guest.name}，迎客 +${regular}`) }
  // 狐娘「魅惑」：偏好一项都没中，也给一截开场分
  if (girl.race === '狐娘' && !raceHit && !traitHit && !outfitMatched) { greet += 2; raceNotes.push('魅惑：迎客 +2') }

  // 低体力惩罚：开场体力 <30 时，挑逗到清洗每步 −2；史莱姆「柔体」减半
  const lowStamina = (girl.stamina ?? 100) < 30
  const lowPen = lowStamina ? (girl.race === '史莱姆' ? 1 : 2) : 0
  if (lowStamina) raceNotes.push(girl.race === '史莱姆' ? '柔体：低体力惩罚减半（每步 −1）' : '体力过低：每步 −2')
  // 哈比「轻身」、鬼娘「怪力」、狼娘「野性」：正戏身侍 +2
  const bodyBonus = main === '身侍' && ['哈比', '鬼娘', '狼娘'].includes(girl.race) ? 2 : 0
  if (bodyBonus) raceNotes.push(`${girl.race === '哈比' ? '轻身' : girl.race === '鬼娘' ? '怪力' : '野性'}：身侍 +2`)

  const rawSteps: StepResult[] = [
    { key: 'greet', label: '迎客', score: clampStep(greet) },
    { key: 'tease', label: '挑逗', zone: '耳朵',
      score: clampStep(STEP_SCORE[statToRank(girl.lewdness)] + ((girl.waist ?? 99) <= 60 ? 2 : 0) + zoneMod(girl, '耳朵') - lowPen) },
    { key: 'foreplay', label: '前戏', zone: '阴蒂',
      score: clampStep(STEP_SCORE[getSkillRank(girl, '手技') ?? '无'] + zoneMod(girl, '阴蒂') - lowPen) },
    { key: 'main', label: '正戏', zone: MAIN_ZONE[main], note: main,
      score: clampStep(STEP_SCORE[getSkillRank(girl, main) ?? '无']
        + (main === '胸侍' ? bustBonus(girl) : main === '身侍' ? hipBonus(girl) : 0)
        + zoneMod(girl, MAIN_ZONE[main]) + bodyBonus - lowPen) },
    { key: 'cleanup', label: '清洗', score: clampStep(STEP_SCORE[statToRank(obedience)] - lowPen) },
  ]
  const steps = masteryFullSteps(rawSteps, girl, main, raceNotes)
  const standardScore = steps.reduce((s, x) => s + x.score, 0)

  // play
  const available = getAvailablePlays(girl, guest)
  const chosenIds = (input.plays && input.plays.length > 0) || !skip ? (input.plays ?? []) : autoPickPlays(girl, guest, slots)
  const plays = chosenIds
    .map((id) => available.find((p) => p.id === id))
    .filter((p): p is PlayDef => !!p)
    .slice(0, slots)
    .map((p) => scorePlay(girl, guest, p))
  const playScore = plays.reduce((s, p) => s + p.score, 0)

  // 黑暗精灵「夜习」：当天第 2、3 场额外满意度 +5
  let satisfactionBonus = girl.race === '黑暗精灵' && (input.sessionIndexToday ?? 0) >= 1 ? 5 : 0
  if (satisfactionBonus) raceNotes.push('夜习：满意度 +5')
  // 技能档对口加成：迎客·待客、前戏·手技、正戏·主类型
  const sk = skillRankBonus(girl, main)
  if (sk.total) { satisfactionBonus += sk.total; raceNotes.push(...sk.notes) }

  // 跳过结算的匹配加成：主类型、play、服装三个维度可叠加（亲自上场不加）
  const matchParts: string[] = []
  let matchBonus = 0
  const matchPotential = (getSkillRank(girl, main) ? SKIP_MATCH_BONUS.service : 0)
    + Math.min(SKIP_MATCH_BONUS.maxPlays, plays.filter((p) => p.matched && p.score > 0).length) * SKIP_MATCH_BONUS.play
    + (outfitMatched ? SKIP_MATCH_BONUS.outfit : 0)
  if (skip) {
    if (getSkillRank(girl, main)) { matchBonus += SKIP_MATCH_BONUS.service; matchParts.push(`主类型 +${SKIP_MATCH_BONUS.service}`) }
    const mp = Math.min(SKIP_MATCH_BONUS.maxPlays, plays.filter((p) => p.matched && p.score > 0).length)
    if (mp) { matchBonus += mp * SKIP_MATCH_BONUS.play; matchParts.push(`对口 play ×${mp} +${mp * SKIP_MATCH_BONUS.play}`) }
    if (outfitMatched) { matchBonus += SKIP_MATCH_BONUS.outfit; matchParts.push(`服装 +${SKIP_MATCH_BONUS.outfit}`) }
    // PLAN.md 阶段 0 验收：一级房、常服、无 play 的跳过不超过 70——只有主类型加成时不越过 70
    if (!mp && !outfitMatched) matchBonus = Math.max(0, Math.min(matchBonus, 70 - (standardScore + playScore + satisfactionBonus)))
    if (!matchBonus) matchParts.length = 0
  }
  // 高档客人更挑剔：直接扣 demand（并入 satisfactionBonus，亲自上场同样生效）
  if (guest.demand) { satisfactionBonus -= guest.demand; raceNotes.push(`挑剔的客人：满意度 −${guest.demand}`) }
  let satisfaction = Math.max(0, Math.min(100, standardScore + playScore + satisfactionBonus + matchBonus))
  // 同一条验收：没对口 play、没对口服装的跳过，技能加成也不把它推过 70
  if (skip && !outfitMatched && !plays.some((p) => p.matched && p.score > 0) && sk.total) {
    satisfaction = Math.min(satisfaction, Math.max(70, standardScore + playScore + satisfactionBonus - sk.total))
  }
  const tier = getSatisfactionTier(satisfaction)
  const reward = serviceReward(guest, girl, satisfaction)

  // 体力：跳过固定 40，敏感档只取本场用到的最高一档
  const zones = [...steps.map((s) => s.zone), ...plays.map((p) => p.zone)].filter((z): z is SensitivityZone => !!z)
  const order = ['迟钝', '普通', '敏感', '弱点'] as const
  let top: (typeof order)[number] | null = null
  for (const z of zones) {
    const v = girl.sensitivities?.[z]
    if (v === undefined) continue
    const lv = getSensitivityLevel(v)
    if (top === null || order.indexOf(lv) > order.indexOf(top)) top = lv
  }
  let staminaExtra = top ? SENSITIVITY_STAMINA_MOD[top] : 0
  let staminaMult = 1
  if (girl.race === '兔娘' && (input.girlSessionsToday ?? 0) >= 1) { staminaMult *= 0.75; raceNotes.push('持久：第二场体力消耗 ×0.75') }
  if ((girl.race === '鬼娘' || girl.race === '狼娘') && main !== '身侍') { staminaExtra -= 10; raceNotes.push(`${girl.race === '鬼娘' ? '怪力' : '野性'}：体力消耗 −10`) }
  const staminaRefund = girl.race === '吸血鬼' && tier.payMult >= 1.3 ? 15 : 0
  if (staminaRefund) raceNotes.push('反哺：满意后返还 15 体力')
  const staminaCost = skip ? serviceStaminaCost(SKIP_SERVICE_STAMINA, { staminaExtra, staminaMult, staminaRefund }) : Math.max(0, staminaExtra)

  const profMult = skip ? 1 : SERVICE_PROF_LIVE_MULT
  const profGains: Proficiency = {}
  const addGain = (k: keyof Proficiency, v: number) => { profGains[k] = (profGains[k] ?? 0) + v * profMult }
  addGain(main, SERVICE_PROF_MAIN); addGain('待客', SERVICE_PROF_SIDE); addGain('手技', SERVICE_PROF_SIDE)
  for (const p of plays) { const d = PLAYS.find((x) => x.id === p.id); if (d && d.source !== 'race') addGain(d.source as keyof Proficiency, SERVICE_PROF_SIDE) }

  return {
    profGains,
    canSkip: canSkipService(girl),
    steps, standardScore, plays, playScore, outfitMatched,
    satisfaction, tier, reward, staminaCost,
    staminaExtra, staminaMult, staminaRefund, satisfactionBonus, matchBonus, matchPotential, matchParts, raceNotes,
    affectionDelta: 1,
    summary: buildServiceSummary(girl.name, guest.name, tier.key, plays.length),
    memoryDetail: serviceDetailLine(girl.name, guest.name, {
      satisfaction, tierLabel: tier.label, outfitMatched, plays: plays.map((p) => p.name), steps,
      outfitName: `${OUTFITS.find((o) => o.id === outfit)?.name ?? '常服'}${stockings !== 'none' ? '+' + (STOCKINGS.find((x) => x.id === stockings)?.name ?? '') : ''}`,
    }),
  }
}

/** 最终体力消耗 */
export function serviceStaminaCost(base: number, r: Pick<ServiceResult, 'staminaExtra' | 'staminaMult' | 'staminaRefund'>): number {
  return Math.max(0, Math.round((base + r.staminaExtra) * r.staminaMult) - r.staminaRefund)
}

/** 收入：龙娘「傲骨」满意及以上 ×1.2 */
export const DRAGON_REWARD_MULT = 1.2
export function serviceReward(guest: Guest, girl: MonstGirl, satisfaction: number): number {
  const base = calcServiceReward({ ...guest, satisfaction })
  return girl.race === '龙娘' && satisfaction >= 70 ? Math.round(base * DRAGON_REWARD_MULT) : base
}

const SUMMARY_TEMPLATES: Record<SatisfactionTier['key'], string> = {
  unsatisfied: '{g}照着流程走完了，{c}却始终提不起兴致，结账时脸色不太好看。',
  normal: '{g}按部就班地招待了{c}，一切都还算顺当，{c}付了钱便离开了。',
  satisfied: '{g}把{c}伺候得服服帖帖，{c}临走前还回头多看了她一眼。',
  ecstatic: '{g}让{c}彻底沉溺其中，{c}一边结账一边念叨着下次还要来。',
}

export interface SummaryDetail { satisfaction?: number; tierLabel?: string; outfitName?: string; outfitMatched?: boolean; plays?: string[]; steps?: Pick<StepResult, 'label' | 'score'>[] }

export function buildServiceSummary(girlName: string, guestName: string, tierKey: SatisfactionTier['key'], playCount: number, detail?: SummaryDetail): string {
  const base = SUMMARY_TEMPLATES[tierKey].replaceAll('{g}', girlName).replaceAll('{c}', guestName)
  const text = playCount > 0 ? `${base}本场追加了 ${playCount} 个花样。` : base
  return detail ? `${text}\n${serviceDetailLine(girlName, guestName, detail)}` : text
}

/** 写给关系记忆的一行要点：满意度｜服装命中｜play｜最出彩 / 最敷衍的步骤 */
export function serviceDetailLine(girlName: string, guestName: string, d: SummaryDetail): string {
  const parts = [`${girlName}×${guestName}：${d.tierLabel ?? ''}${d.satisfaction !== undefined ? `（${d.satisfaction}）` : ''}`]
  if (d.outfitName && d.outfitName !== '常服') parts.push(`${d.outfitName}${d.outfitMatched ? '命中偏好' : '未对口'}`)
  if (d.plays?.length) parts.push(`play：${d.plays.join('、')}`)
  const steps = (d.steps ?? []).filter((x) => x.score !== undefined)
  if (steps.length) {
    const best = steps.reduce((a, b) => (b.score > a.score ? b : a))
    const worst = steps.reduce((a, b) => (b.score < a.score ? b : a))
    parts.push(best === worst ? `${best.label} ${best.score}/${STEP_MAX}` : `${best.label} ${best.score}/${STEP_MAX} 最出彩，${worst.label} ${worst.score}/${STEP_MAX} 最弱`)
  }
  return parts.join('｜')
}
