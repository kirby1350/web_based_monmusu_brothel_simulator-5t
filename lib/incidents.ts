// 阶段 10：事件生成与惩罚资格（纯函数，随机数可注入）
import type { GameSave, Guest, Incident, MonstGirl } from './types'
import {
  INCIDENT_TEMPLATES, RACE_INCIDENT_TEMPLATES, AFFECTION_INCIDENT_TEMPLATES, INCIDENT_LOW_AFFECTION, INCIDENT_HIGH_AFFECTION, SERVICE_FAIL_INCIDENT_CHANCE, DAILY_MISCHIEF_CHANCE, INCIDENT_OVERNIGHT_OBEDIENCE, getSkillRank,
} from './catalog'

type Rng = () => number

/** 「不满」结算后按概率记一条接客失败；已有事件时不叠加 */
export function serviceFailIncident(girl: MonstGirl, guest: Guest, tierKey: string, day: number, rng: Rng = Math.random): Incident | null {
  if (tierKey !== 'unsatisfied' || girl.incident) return null
  if (rng() >= SERVICE_FAIL_INCIDENT_CHANCE) return null
  return { kind: '接客失败', text: `没能让客人${guest.name}满意，惹恼了对方`, day }
}

/** 每天结束：先对过夜未处理的事件扣服从（好感不变），再按概率随机一人闯祸 */
export function nightlyIncidents(girls: MonstGirl[], day: number, rng: Rng = Math.random): MonstGirl[] {
  const after = girls.map((g) => (g.incident ? { ...g, obedience: Math.max(0, g.obedience - INCIDENT_OVERNIGHT_OBEDIENCE) } : g))
  if (rng() >= DAILY_MISCHIEF_CHANCE) return after
  const free = after.filter((g) => !g.incident)
  if (!free.length) return after
  const who = free[Math.min(free.length - 1, Math.floor(rng() * free.length))]
  const pool = mischiefPool(who)
  const text = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
  return after.map((g) => (g.id === who.id ? { ...g, incident: { kind: '闯祸', text, day } } : g))
}

/** 这名魔物娘可能闯的祸：通用 + 本种族专属 + 按好感分档 */
export function mischiefPool(girl: MonstGirl): string[] {
  const aff = girl.affection ?? 0
  return [
    ...INCIDENT_TEMPLATES,
    ...(RACE_INCIDENT_TEMPLATES[girl.race] ?? []),
    ...(aff < INCIDENT_LOW_AFFECTION ? AFFECTION_INCIDENT_TEMPLATES.low : []),
    ...(aff >= INCIDENT_HIGH_AFFECTION ? AFFECTION_INCIDENT_TEMPLATES.high : []),
  ]
}

/** M 性熟练及以上：没有事件也可以惩罚 */
export function hasMasochistLicense(girl: MonstGirl): boolean {
  const r = getSkillRank(girl, 'M性')
  return r === '熟练' || r === '精通'
}

export function canPunish(girl: MonstGirl): boolean {
  return !!girl.incident || hasMasochistLicense(girl)
}

/** 亲自上场惩罚时附在提示词末尾的一句 */
export function incidentPromptLine(girl: MonstGirl): string {
  if (girl.incident) return `【惩罚缘由】${girl.name}${girl.incident.text}（${girl.incident.kind}），这是对此的惩罚。`
  return `【惩罚缘由】${girl.name}没有犯错，是她自己渴望被惩罚。`
}

