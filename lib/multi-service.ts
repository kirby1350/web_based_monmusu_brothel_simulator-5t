// 多人服务：主位一名 + 协同 1–2 名，一起接待同一位客人
import type { Guest, MonstGirl, SkillRank } from './types'
import { getSkillRank } from './catalog'
import { getMainService, serviceReward, traitMatched, type ServiceResult } from './resolve-service'
import { getSatisfactionTier } from './game-engine'
import { canSkipService } from './resolve-service'

/** 协同人数上限：服务房间 1–2 级 1 人，3 级起 2 人 */
export function maxPartners(roomLevel: number): number {
  return roomLevel >= 3 ? 2 : 1
}
/** 协同的最低体力 */
export const PARTNER_MIN_STAMINA = 25
/** 协同体力 = 主位消耗 × 0.6 */
export const PARTNER_STAMINA_MULT = 0.6
/** 收入：每多一人 +20%（多占一个人的体力与出场） */
export const PARTNER_REWARD_MULT = 0.2
/** 协同熟练度 = 主位增量的一半 */
export const PARTNER_PROF_MULT = 0.5
/** 默契加成上限（两位协同合计） */
export const SYNERGY_CAP = 12
const RANK_SUPPORT: Record<SkillRank, number> = { 初学: 1, 熟练: 3, 精通: 5 }

export function partnerEligible(g: MonstGirl, leadId: string | undefined): string | null {
  if (g.id === leadId) return '主位'
  if (g.exhausted) return '疲惫'
  if ((g.stamina ?? 100) < PARTNER_MIN_STAMINA) return `体力不足 ${PARTNER_MIN_STAMINA}`
  return null
}

export interface Synergy { total: number; parts: string[] }

/**
 * 默契加成：每位协同基础 +2；会主类型（初学 +1 / 熟练 +3 / 精通 +5）；
 * 客人偏好的种族或身体特征 +3；与主位同族「姐妹配合」+2；两人好感都 ≥ 60「默契」+2；
 * 服从 < 25 不肯配合 −4。第二位协同只算 60%，合计封顶 +12。
 */
export function partnerSynergy(lead: MonstGirl, partners: MonstGirl[], guest: Guest): Synergy {
  const main = getMainService(guest)
  const parts: string[] = []
  let total = 0
  partners.forEach((p, i) => {
    let v = 2
    const notes: string[] = ['新鲜感 +2']
    const r = getSkillRank(p, main)
    if (r) { v += RANK_SUPPORT[r]; notes.push(`${main}${r} +${RANK_SUPPORT[r]}`) }
    if ((guest.prefRace && guest.prefRace === p.race) || traitMatched(guest, p)) { v += 3; notes.push('客人偏好 +3') }
    if (p.race === lead.race) { v += 2; notes.push('姐妹配合 +2') }
    if (p.affection >= 60 && lead.affection >= 60) { v += 2; notes.push('默契 +2') }
    if (!canSkipService(p)) { v -= 4; notes.push('不肯配合 −4') }
    const w = i === 0 ? 1 : 0.6
    const got = Math.round(v * w)
    total += got
    parts.push(`${p.name} ${got >= 0 ? '+' : ''}${got}（${notes.join('、')}${i > 0 ? '，第二位 ×0.6' : ''}）`)
  })
  return { total: Math.max(-8, Math.min(SYNERGY_CAP, total)), parts }
}

/** 给单人结算结果叠上协同：满意度、档位、收入、协同体力 */
export function applyPartners<T extends ServiceResult>(result: T, plan: { girl: MonstGirl; guest: Guest; partners?: MonstGirl[] }): T {
  const partners = plan.partners ?? []
  if (!partners.length) return result
  const syn = partnerSynergy(plan.girl, partners, plan.guest)
  const satisfaction = Math.max(0, Math.min(100, result.satisfaction + syn.total))
  const reward = Math.round(serviceReward(plan.guest, plan.girl, satisfaction) * (1 + PARTNER_REWARD_MULT * partners.length))
  return {
    ...result,
    satisfaction, tier: getSatisfactionTier(satisfaction), reward,
    synergy: syn.total, synergyParts: syn.parts,
    partnerStamina: Object.fromEntries(partners.map((p) => [p.id, Math.round(result.staminaCost * PARTNER_STAMINA_MULT)])),
  }
}
