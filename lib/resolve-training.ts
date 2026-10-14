// 调教结算（纯函数）：驯服 / 放权 / 塑形 / 特训 / 敏感开发
// 阶段 0 只算一级空房基础值 × 调教室倍率；道具、服装、种族特技加成留到阶段 5。
import type { MonstGirl, SensitivityZone, SkillKey, SkillRank, TrainingDirection } from './types'
import {
  SCULPT_POTIONS, SCULPT_BOUNDS, TRAINING_ROOM_MULT, SKILL_PROGRESS_PER_RANK, SKIP_OBEDIENCE_MIN,
} from './catalog'

export const TRAINING_DIRECTIONS: { key: TrainingDirection; label: string }[] = [
  { key: 'tame', label: '驯服' },
  { key: 'release', label: '放权' },
  { key: 'sculpt', label: '塑形' },
  { key: 'drill', label: '特训' },
  { key: 'sensitize', label: '敏感开发' },
]

/** 跳过调教的体力消耗（TODO/PLAN 未给数值，暂定 20） */
export const TRAINING_STAMINA_COST = 20

export interface TrainingInput {
  girl: MonstGirl
  direction: TrainingDirection
  roomLevel?: number
  skip: boolean
  potionId?: string           // 塑形
  skill?: SkillKey            // 特训
  zone?: SensitivityZone      // 敏感开发
}

export interface TrainingResult {
  ok: boolean
  error?: string
  delta: { obedience: number; lewdness: number; affection: number; m: number; s: number; sensitivity: number; skillProgress: number }
  measurement?: { stat: 'bust' | 'waist' | 'hip'; from: number; to: number }
  newRank?: SkillRank
  staminaCost: number
  girl: MonstGirl   // 应用后的魔物娘
  summary: string
}

const RANKS: SkillRank[] = ['初学', '熟练', '精通']
const clamp100 = (n: number) => Math.max(0, Math.min(100, n))

export function getTrainingMult(roomLevel?: number): number {
  const lv = Math.max(1, Math.min(4, roomLevel ?? 1))
  return TRAINING_ROOM_MULT[lv - 1]
}

export function resolveTraining(input: TrainingInput): TrainingResult {
  const { girl, direction, skip } = input
  const mult = getTrainingMult(input.roomLevel)
  const m = (n: number) => Math.round(n * mult)
  const delta = { obedience: 0, lewdness: 0, affection: 0, m: 0, s: 0, sensitivity: 0, skillProgress: 0 }
  const next: MonstGirl = { ...girl }
  let measurement: TrainingResult['measurement']
  let newRank: SkillRank | undefined
  const fail = (error: string): TrainingResult => ({ ok: false, error, delta, staminaCost: 0, girl, summary: error })

  switch (direction) {
    case 'tame': {
      let ob = m(6)
      if (skip && girl.obedience < SKIP_OBEDIENCE_MIN) ob = Math.round(ob * 0.8)
      delta.obedience = ob; delta.m = m(1); delta.affection = m(1)
      break
    }
    case 'release':
      delta.lewdness = m(6); delta.s = m(1); delta.affection = m(1)
      break
    case 'sculpt': {
      const potion = SCULPT_POTIONS.find((p) => p.id === input.potionId)
      if (!potion) return fail('需要指定一瓶塑形药')
      const [lo, hi] = SCULPT_BOUNDS[potion.stat]
      const from = girl[potion.stat]
      const to = Math.max(lo, Math.min(hi, from + potion.delta)) // 厘米数不吃倍率
      next[potion.stat] = to
      measurement = { stat: potion.stat, from, to }
      const counts = girl.sculptCounts ?? { bust: 0, waist: 0, hip: 0 }
      next.sculptCounts = { ...counts, [potion.stat]: counts[potion.stat] + 1 }
      delta.lewdness = m(1)
      break
    }
    case 'drill': {
      const skill = input.skill
      const rank = skill ? girl.skillRanks?.[skill] : undefined
      if (!skill || !rank) return fail('只能特训已选的技能')
      delta.skillProgress = m(1)
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
      delta.sensitivity = m(10)
      next.sensitivities = { ...girl.sensitivities, [zone]: clamp100((girl.sensitivities?.[zone] ?? 30) + delta.sensitivity) }
      break
    }
  }

  next.obedience = clamp100(girl.obedience + delta.obedience)
  next.lewdness = clamp100(girl.lewdness + delta.lewdness)
  next.affection = clamp100(girl.affection + delta.affection)
  if (delta.m || delta.s) {
    const p = girl.msProgress ?? { m: 0, s: 0 }
    next.msProgress = { m: p.m + delta.m, s: p.s + delta.s }
  }
  const staminaCost = TRAINING_STAMINA_COST
  next.stamina = Math.max(0, (girl.stamina ?? 100) - staminaCost)
  const label = TRAINING_DIRECTIONS.find((d) => d.key === direction)!.label
  return { ok: true, delta, measurement, newRank, staminaCost, girl: next, summary: `${girl.name}完成了一轮${label}。` }
}
