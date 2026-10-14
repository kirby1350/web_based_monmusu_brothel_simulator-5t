// 接客结算（纯函数）：五步标准流程 + 额外 play → 满意度 / 档位 / 收入 / 体力
import type { Guest, MonstGirl, OutfitId, SensitivityZone, ServingSkill, SkillRank, StockingId } from './types'
import {
  GREET_HOSTING_SCORE, STEP_SCORE, STEP_MAX, PLAY_SCORE, PLAYS, PlayDef, WRONG_SIDE_PLAY_PENALTY,
  OUTFITS, STOCKINGS, RACE_TRAITS, getPlaySlots, getGuestProfile, getSkillRank, getInclination,
  getSensitivityLevel, SENSITIVITY_STEP_MOD, SENSITIVITY_STAMINA_MOD, SKIP_SERVICE_STAMINA,
  SKIP_OBEDIENCE_MIN, DRAGON_SKIP_OBEDIENCE_MULT, ANAL_UNLOCK,
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
}

export interface StepResult { key: ServiceStepKey; label: string; score: number; zone?: SensitivityZone; note?: string }
export interface PlayResult { id: string; name: string; score: number; matched: boolean; rank: SkillRank; zone?: SensitivityZone }

export interface ServiceResult {
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
  affectionDelta: number
  summary: string
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

function traitMatched(guest: Guest, girl: MonstGirl): boolean {
  switch (guest.prefTrait) {
    case '巨乳': return (girl.bust ?? 0) >= 95
    case '贫乳': return (girl.bust ?? 0) > 0 && (girl.bust ?? 0) <= 82
    case '丰臀': return (girl.hip ?? 0) >= 95
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

/** 她能选的 play（已会技能 / M·S / 种族特技），正戏占用的主类型除外 */
export function getAvailablePlays(girl: MonstGirl, guest: Guest): PlayDef[] {
  const main = getMainService(guest)
  const inc = getInclination(girl)
  return PLAYS.filter((p) => {
    if (p.source === main) return false
    if (p.source === 'race') return !!RACE_TRAITS[girl.race]
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
      rank = '熟练'
      matched = profile.service === '种族'
    } else {
      rank = getSkillRank(girl, play.source) ?? '初学'
      matched = profile.service === play.source || profile.secondary.includes(play.source as ServingSkill)
    }
    score = matched ? PLAY_SCORE[rank] : Math.floor(PLAY_SCORE[rank] / 2)
    if (play.id === 'paizuri') score += bustBonus(girl)
    if (play.id === 'positions') score += hipBonus(girl)
  }
  if (score > 0) score += zoneMod(girl, play.zone)
  const name = play.source === 'race' ? (RACE_TRAITS[girl.race] ?? play.name) : play.name
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

// ─── 主结算 ───────────────────────────────────────────────────────────────────

export function resolveService(input: ServiceInput): ServiceResult {
  const { girl, guest, skip } = input
  const outfit = input.outfit ?? 'regular'
  const stockings = input.stockings ?? 'none'
  const slots = getPlaySlots(input.roomLevel)
  const main = getMainService(guest)
  const obedience = skip && girl.race === '龙娘' ? Math.floor(girl.obedience * DRAGON_SKIP_OBEDIENCE_MULT) : girl.obedience

  // 迎客
  const outfitPref = OUTFITS.find((o) => o.id === outfit)?.pref ?? null
  const stockingPref = STOCKINGS.find((s) => s.id === stockings)?.pref ?? null
  const outfitMatched = !!guest.prefOutfit && (outfitPref === guest.prefOutfit || stockingPref === guest.prefOutfit)
  let greet = GREET_HOSTING_SCORE[getSkillRank(girl, '待客') ?? '无']
  if (guest.prefRace && guest.prefRace === girl.race) greet += 2
  if (traitMatched(guest, girl)) greet += 2
  if (outfitMatched) greet += 4
  else if (guest.prefOutfit && outfit !== 'regular') greet -= 2

  const steps: StepResult[] = [
    { key: 'greet', label: '迎客', score: clampStep(greet) },
    { key: 'tease', label: '挑逗', zone: '耳朵',
      score: clampStep(STEP_SCORE[statToRank(girl.lewdness)] + ((girl.waist ?? 99) <= 60 ? 2 : 0) + zoneMod(girl, '耳朵')) },
    { key: 'foreplay', label: '前戏', zone: '阴蒂',
      score: clampStep(STEP_SCORE[getSkillRank(girl, '手技') ?? '无'] + zoneMod(girl, '阴蒂')) },
    { key: 'main', label: '正戏', zone: MAIN_ZONE[main], note: main,
      score: clampStep(STEP_SCORE[getSkillRank(girl, main) ?? '无']
        + (main === '胸侍' ? bustBonus(girl) : main === '身侍' ? hipBonus(girl) : 0)
        + zoneMod(girl, MAIN_ZONE[main])) },
    { key: 'cleanup', label: '清洗', score: clampStep(STEP_SCORE[statToRank(obedience)]) },
  ]
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

  const satisfaction = Math.max(0, Math.min(100, standardScore + playScore))
  const tier = getSatisfactionTier(satisfaction)
  const reward = calcServiceReward({ ...guest, satisfaction })

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
  const staminaCost = (skip ? SKIP_SERVICE_STAMINA : 0) + (top ? SENSITIVITY_STAMINA_MOD[top] : 0)

  return {
    canSkip: canSkipService(girl),
    steps, standardScore, plays, playScore, outfitMatched,
    satisfaction, tier, reward, staminaCost,
    affectionDelta: 1,
    summary: buildServiceSummary(girl.name, guest.name, tier.key, plays.length),
  }
}

const SUMMARY_TEMPLATES: Record<SatisfactionTier['key'], string> = {
  unsatisfied: '{g}照着流程走完了，{c}却始终提不起兴致，结账时脸色不太好看。',
  normal: '{g}按部就班地招待了{c}，一切都还算顺当，{c}付了钱便离开了。',
  satisfied: '{g}把{c}伺候得服服帖帖，{c}临走前还回头多看了她一眼。',
  ecstatic: '{g}让{c}彻底沉溺其中，{c}一边结账一边念叨着下次还要来。',
}

export function buildServiceSummary(girlName: string, guestName: string, tierKey: SatisfactionTier['key'], playCount: number): string {
  const base = SUMMARY_TEMPLATES[tierKey].replaceAll('{g}', girlName).replaceAll('{c}', guestName)
  return playCount > 0 ? `${base}本场追加了 ${playCount} 个花样。` : base
}
