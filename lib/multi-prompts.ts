// 多人服务的分工（只进提示词）：主位做主类型，协同按各自最拿手的技能自动分工；默契加成的来源写成能描写的互动。
import type { Guest, MonstGirl, ServingSkill, SkillRank } from './types'
import { getSkillRank } from './catalog'
import { getMainService, traitMatched, canSkipService } from './resolve-service'

const SUPPORT_SKILLS: ServingSkill[] = ['口侍', '胸侍', '手技', '身侍', '待客']
const RANK_ORDER: Record<SkillRank, number> = { 初学: 1, 熟练: 2, 精通: 3 }

/** 协同在正戏里负责的那一份（按技能） */
export const SUPPORT_ROLE: Record<ServingSkill | '无', string> = {
  口侍: '用唇舌负责他的上半身——接吻、舔他的乳头与喉结，主位换气时接过去含住',
  胸侍: '从背后或侧面用胸贴住他，让他枕在乳间，或与主位一左一右用胸夹住',
  手技: '用手爱抚他身体的其余部分——揉他的囊袋、腰和大腿内侧，替主位稳住节奏',
  身侍: '贴着他磨蹭、跨坐在他胸前或脸上，与主位交替着骑上去',
  待客: '在旁喂酒、贴耳说下流话、替他擦汗，用声音和眼神把气氛推高',
  无: '在旁协助——亲吻、抚摸、递毛巾，学着主位的样子',
}

/** 协同的分工技能：避开主位的主类型（除非她只会这一项），取最高档；都不会时为「无」 */
export function partnerRole(p: MonstGirl, main: string): ServingSkill | '无' {
  const ranked = SUPPORT_SKILLS.map((k) => ({ k, r: getSkillRank(p, k) })).filter((x) => x.r) as { k: ServingSkill; r: SkillRank }[]
  if (!ranked.length) return '无'
  const others = ranked.filter((x) => x.k !== main)
  const pool = others.length ? others : ranked
  return pool.sort((a, b) => RANK_ORDER[b.r] - RANK_ORDER[a.r])[0].k
}

/** 默契的来源 → 叙述里可写的互动 */
export function synergyInteractions(lead: MonstGirl, p: MonstGirl, guest: Guest, first = true): string[] {
  const main = getMainService(guest)
  const out: string[] = first ? ['几个人同时侍奉的新鲜感：写他被左右夹击、顾此失彼的享受'] : []
  if (getSkillRank(p, main as ServingSkill)) out.push(`她也会${main}：正戏里能和${lead.name}轮流接手，交接时不断档`)
  if ((guest.prefRace && guest.prefRace === p.race) || traitMatched(guest, p)) out.push(`她正合${guest.name}的偏好：他的目光会被她吸走，${lead.name}可以借此吃醋或顺势把她推到他面前`)
  if (p.race === lead.race) out.push(`与${lead.name}同族的姐妹配合：同样的耳朵/尾巴/身体一起动，动作像镜像`)
  if (p.affection >= 60 && lead.affection >= 60) out.push(`与${lead.name}默契十足：对视一眼就知道下一步谁做什么，偶尔两人自己也亲上一口`)
  if (!canSkipService(p)) out.push(`她不太情愿：动作慢半拍、要${lead.name}哄着或带着她，别让她显得积极`)
  return out
}

const STEP_SHARE = [
  '迎客时：主位上前招呼，协同在旁倒酒、接过外衣，各自打一声招呼',
  '挑逗时：两人一左一右贴耳，一个说话一个吹气，轮流撩拨',
  '前戏时：主位负责主要的爱抚，协同按她的分工做轻一些的那份（仍不插入）',
  '正戏时：主位做主类型，协同按分工补位，必要时交替接手',
  '清洗时：两人一起替他清理、一左一右依偎着他',
]

/** 【分工】段：只在有协同时给 */
export function divisionBlock(lead: MonstGirl, partners: MonstGirl[], guest: Guest, stepIndex: number): string {
  if (!partners.length) return ''
  const main = getMainService(guest)
  const lines = [`- ${lead.name}（主位）：负责主类型「${main}」，掌握整场的节奏`]
  partners.forEach((p, i) => {
    const role = partnerRole(p, main)
    lines.push(`- ${p.name}（协同·${role === '无' ? '还没有拿手的技能' : role}）：${SUPPORT_ROLE[role]}`)
    lines.push(...synergyInteractions(lead, p, guest, i === 0).map((x) => `  · ${x}`))
  })
  return `【多人分工（这一步：${STEP_SHARE[stepIndex] ?? ''}）】\n${lines.join('\n')}`
}
