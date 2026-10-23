// 兴奋度 / 快感值（play-2 第 2 点）：亲自上场时客人与每位魔物娘各一份，本地计算。
// 用途：①写进提示词让说话方式随之变化（从容 → 动摇 → 慌乱 → 临界 → 高潮）；②少量喂给亲自上场的满意度（见 live-steps）。
import type { Guest, MonstGirl, SensitivityZone } from './types'
import { getSensitivityLevel, getSkillRank, getGuestProfile, OUTFITS, STOCKINGS } from './catalog'
import { fetishMatchesGuest } from './scenes'
import { regularBonus } from './girl-memory'
import { traitMatched } from './resolve-service'

export interface Heat { arousal: number; pleasure: number; climaxes: number }
export interface HeatState {
  guest: Heat
  /** 按魔物娘 id */
  girls: Record<string, Heat>
  /** 本回合刚发生的高潮（写进下一条请求的提示词）：'guest' 或魔物娘 id */
  justClimaxed: string[]
  /** 同一回合双方一起高潮过 */
  together: boolean
}

export const HEAT_MAX = 100
export const CLIMAX_RESET_PLEASURE = 30
export const CLIMAX_AROUSAL_DROP = 15
/** 每步每回合的基础增量：迎客 / 挑逗 / 前戏 / 正戏 / 清洗 */
export const STEP_AROUSAL = [6, 10, 10, 8, -12]
export const STEP_PLEASURE = [0, 4, 10, 16, 0]
export const CLEANUP_PLEASURE_DROP = 15
export const SKIP_STEP_COOL = 4
export const PLAY_PLEASURE = 6
export const SKILL_PLEASURE_MULT: Record<string, number> = { 无: 0.7, 初学: 0.9, 熟练: 1.1, 精通: 1.3 }
export const ZONE_PLEASURE_MULT: Record<string, number> = { 迟钝: 0.6, 普通: 1, 敏感: 1.3, 弱点: 1.6 }

const clamp = (n: number, lo = 0, hi = HEAT_MAX) => Math.max(lo, Math.min(hi, n))
const r1 = (n: number) => Math.round(n * 10) / 10

export const INTENSE_WORDS = ['用力', '更快', '加快', '狠狠', '深一点', '更深', '猛', '粗暴', '使劲', '顶到', '激烈']
export const GENTLE_WORDS = ['慢慢', '轻轻', '温柔', '轻一点', '慢一点', '抱着', '亲吻', '摸摸头', '耳语']

/** 客人对这位魔物娘的偏好命中（种族 / 特征各 15，服装 10，觉醒性癖对口 10，熟客 5） */
export function guestMatchHeat(guest: Guest, girl: MonstGirl, outfit?: string, stockings?: string): number {
  let n = 0
  if (guest.prefRace && guest.prefRace === girl.race) n += 15
  if (traitMatched(guest, girl)) n += 15
  const op = OUTFITS.find((o) => o.id === outfit)?.pref, sp = STOCKINGS.find((s) => s.id === stockings)?.pref
  if (guest.prefOutfit && (op === guest.prefOutfit || sp === guest.prefOutfit)) n += 10
  if ((girl.awakened ?? []).some((id) => fetishMatchesGuest(id, guest))) n += 10
  if (regularBonus(girl, guest)) n += 5
  return n
}

export function initHeat(guest: Guest, girls: MonstGirl[], outfit?: string, stockings?: string): HeatState {
  const best = Math.max(0, ...girls.map((g) => guestMatchHeat(guest, g, outfit, stockings)))
  const fetishHit = (g: MonstGirl) => (g.awakened ?? []).some((id) => fetishMatchesGuest(id, guest))
  return {
    guest: { arousal: clamp(15 + best, 0, 70), pleasure: 0, climaxes: 0 },
    girls: Object.fromEntries(girls.map((g) => [g.id, { arousal: clamp(Math.round(g.lewdness / 3 + g.affection / 10 + (fetishHit(g) ? 10 : 0)), 0, 70), pleasure: 0, climaxes: 0 }])),
    justClimaxed: [],
    together: false,
  }
}

export interface HeatTurnInput {
  stepIndex: number
  guest: Guest
  girls: MonstGirl[]
  /** 正戏主类型（口侍/胸侍/身侍） */
  mainSkill: string
  /** 这一步碰到的敏感带 */
  zone?: SensitivityZone
  /** 本回合新插入的 play 数 */
  newPlays?: number
  /** 玩家这回合的原话 */
  text?: string
  /** 对口（命中客人需求 / 做法 / play 关键词） */
  onTopic?: boolean
  outfit?: string
  stockings?: string
}

/** 玩家这一回合：按步骤、技能、敏感、对口、用词推进双方兴奋/快感；快感到顶记一次高潮 */
export function heatTurn(state: HeatState, input: HeatTurnInput): HeatState {
  const i = Math.max(0, Math.min(4, input.stepIndex))
  const text = input.text ?? ''
  const intense = INTENSE_WORDS.some((w) => text.includes(w))
  const gentle = !intense && GENTLE_WORDS.some((w) => text.includes(w))
  const wordMult = intense ? 1.3 : gentle ? 0.8 : 1
  const topic = input.onTopic ? 1.2 : 1
  const playP = (input.newPlays ?? 0) * PLAY_PLEASURE
  const just: string[] = []
  const step = (h: Heat, dA: number, dP: number, who: string): Heat => {
    let arousal = clamp(h.arousal + dA + (gentle ? 3 : 0))
    let pleasure = i === 4 ? clamp(h.pleasure - CLEANUP_PLEASURE_DROP) : clamp(h.pleasure + dP * (arousal >= 60 ? 1.2 : 1))
    let climaxes = h.climaxes
    if (pleasure >= HEAT_MAX) { climaxes += 1; pleasure = CLIMAX_RESET_PLEASURE; arousal = clamp(arousal - CLIMAX_AROUSAL_DROP); just.push(who) }
    return { arousal: r1(arousal), pleasure: r1(pleasure), climaxes }
  }
  // 客人：兴奋看偏好命中率，快感看她们的技能（取最好的那位）
  const match = Math.max(0, ...input.girls.map((g) => guestMatchHeat(input.guest, g, input.outfit, input.stockings)))
  const stepSkill = i === 0 ? '待客' : i === 2 ? '手技' : i === 3 ? input.mainSkill : undefined
  const skillMult = Math.max(...input.girls.map((g) => SKILL_PLEASURE_MULT[(stepSkill && getSkillRank(g, stepSkill as Parameters<typeof getSkillRank>[1])) || '无']))
  const multi = input.girls.length > 1 ? 1 + 0.25 * (input.girls.length - 1) : 1
  const guest = step(state.guest, STEP_AROUSAL[i] * (1 + match / 100) * topic, (STEP_PLEASURE[i] * skillMult * wordMult * topic + playP) * multi, 'guest')
  const girls: Record<string, Heat> = {}
  for (const g of input.girls) {
    const h = state.girls[g.id] ?? { arousal: 0, pleasure: 0, climaxes: 0 }
    const zv = input.zone ? g.sensitivities?.[input.zone] : undefined
    const zoneMult = zv === undefined ? 1 : ZONE_PLEASURE_MULT[getSensitivityLevel(zv)]
    girls[g.id] = step(h, STEP_AROUSAL[i] * (0.6 + g.lewdness / 100), STEP_PLEASURE[i] * zoneMult * wordMult + playP, g.id)
  }
  const together = state.together || (just.includes('guest') && just.length > 1)
  return { guest, girls, justClimaxed: just, together }
}

/** 一步写 0 回合就按下一步：所有人兴奋 −4（冷场）；无论如何清空「刚高潮」 */
export function heatAdvance(state: HeatState, skipped: boolean): HeatState {
  const cool = (h: Heat): Heat => (skipped ? { ...h, arousal: clamp(h.arousal - SKIP_STEP_COOL) } : h)
  return { ...state, guest: cool(state.guest), girls: Object.fromEntries(Object.entries(state.girls).map(([k, h]) => [k, cool(h)])), justClimaxed: [] }
}

/** 模型 STATS 给的她的快感变化：×0.5 并入，限制在 −5~+10，且不会因此高潮（最高 95） */
export function heatModelNudge(state: HeatState, girlId: string, pleasureDelta: number): HeatState {
  const h = state.girls[girlId]
  if (!h) return state
  const d = Math.max(-5, Math.min(10, pleasureDelta)) * 0.5
  return { ...state, girls: { ...state.girls, [girlId]: { ...h, pleasure: r1(Math.max(0, Math.min(95, h.pleasure + d))) } } }
}

// ─── 说话档位 ────────────────────────────────────────────────────────────────

export type SpeechBand = '从容' | '动摇' | '慌乱' | '临界' | '高潮'
export function speechBand(h: Heat, justClimaxed = false): SpeechBand {
  if (justClimaxed) return '高潮'
  const v = Math.max(h.arousal * 0.8, h.pleasure)
  return v >= 85 ? '临界' : v >= 60 ? '慌乱' : v >= 35 ? '动摇' : '从容'
}
const GIRL_BAND: Record<SpeechBand, string> = {
  从容: '说话完整、按平常的口吻，只在语气里透出一点期待或紧张',
  动摇: '呼吸开始乱，句子偶尔停顿、语尾发颤、口吃，偶尔一声短促的惊叫，会下意识地掩饰',
  慌乱: '每句都夹一声淫叫，「齁」接拉长的元音，带 ❤ 和叠感叹号，句子被打断、词开始重复，口癖还在但变了形',
  临界: '长串淫叫（齁哦哦哦哦哦——！！❤❤），同一个词三连，只剩词语、对方的名字和口癖的碎片，哭腔，身体先于语言',
  高潮: '本回合要写出她的高潮：具体到身体的收缩、颤抖与体液，台词只剩破碎的音节与口癖残片，之后是余韵里的喘息',
}
const GUEST_BAND: Record<SpeechBand, string> = {
  从容: '从容、有余裕，按他的性格说话',
  动摇: '呼吸变重，话变少，动作开始急',
  慌乱: '急躁、粗喘，说话短促，只顾追着快感',
  临界: '濒临射精，只剩低吼和短句，动作失控',
  高潮: '本回合要写出他射精的过程（具体细节），之后是短暂的脱力',
}

/** 谁这回合可以写高潮：只有被标为「高潮」的人；没人时全员最多写到濒临 */
export function climaxGateLine(state: HeatState, guestName: string, girls: Pick<MonstGirl, 'id' | 'name'>[]): string {
  const who = [state.justClimaxed.includes('guest') ? guestName : '', ...girls.filter((g) => state.justClimaxed.includes(g.id)).map((g) => g.name)].filter(Boolean)
  return who.length
    ? `本回合只有${who.join('、')}可以写高潮${state.justClimaxed.includes('guest') ? '（客人射精）' : ''}；其余人最多写到「濒临」——忍住、被拉回、差一点`
    : '本回合没有人到达高潮：任何人都不许写射精、内射、潮吹、绝顶；最多写到「濒临」——忍住、被拉回、差一点'
}

export function heatPromptBlock(state: HeatState, guestName: string, girls: Pick<MonstGirl, 'id' | 'name'>[]): string {
  const line = (name: string, h: Heat, band: SpeechBand, desc: string) =>
    `- ${name}：兴奋 ${Math.round(h.arousal)}/100，快感 ${Math.round(h.pleasure)}/100${h.climaxes ? `，已高潮 ${h.climaxes} 次` : ''}｜${band}：${desc}`
  const gb = speechBand(state.guest, state.justClimaxed.includes('guest'))
  const rows = [line(guestName, state.guest, gb, GUEST_BAND[gb]), ...girls.map((g) => {
    const h = state.girls[g.id]
    if (!h) return ''
    const b = speechBand(h, state.justClimaxed.includes(g.id))
    return line(g.name, h, b, GIRL_BAND[b])
  })].filter(Boolean)
  return `【此刻的兴奋与快感（本地计算，叙述与台词必须对得上）】\n${rows.join('\n')}\n说话方式随档位变化，但每个人的性格、自称与口癖保持不变——只改变说话的完整度和节奏。\n高潮闸门：${climaxGateLine(state, guestName, girls)}${state.together ? '\n（本场已经一起高潮过一次，可以在余韵里呼应。）' : ''}`
}

/** 喂给亲自上场满意度的部分：客人高潮过 +3，和她一起高潮过再 +2（合计封顶 5） */
export const HEAT_SAT_CLIMAX = 3
export const HEAT_SAT_TOGETHER = 2
export function heatSatBonus(state: HeatState | undefined): number {
  if (!state) return 0
  return Math.min(HEAT_SAT_CLIMAX + HEAT_SAT_TOGETHER, (state.guest.climaxes > 0 ? HEAT_SAT_CLIMAX : 0) + (state.together ? HEAT_SAT_TOGETHER : 0))
}

/** 界面：一个参与者的条 */
export function heatBars(h: Heat) { return { arousal: Math.round(h.arousal), pleasure: Math.round(h.pleasure), climaxes: h.climaxes } }

export { getGuestProfile }

// ─── 调教的亲自上场：同样的档位，让她的说话随回合推进（不进调教结算） ───────────
/** 调教回合的阶段：第 1 回合像挑逗、2–3 回合像前戏、之后像正戏（一场调教通常 6–10 回合） */
export const TRAINING_PHASE = (turn: number) => (turn <= 1 ? 1 : turn <= 3 ? 2 : 3)
export const TRAINER_PLEASURE_MULT = 0.6

export function initTrainingHeat(girl: MonstGirl): HeatState {
  return {
    guest: { arousal: 20, pleasure: 0, climaxes: 0 },
    girls: { [girl.id]: { arousal: clamp(Math.round(girl.lewdness / 3 + girl.affection / 10)), pleasure: 0, climaxes: 0 } },
    justClimaxed: [],
    together: false,
  }
}

/** 调教的一回合：她按阶段 + 开发部位的敏感 + 用词推进；调教者（馆主）快感涨得慢一些 */
export function trainingHeatTurn(state: HeatState, girl: MonstGirl, turn: number, text: string, zone?: SensitivityZone): HeatState {
  const i = TRAINING_PHASE(turn)
  const intense = INTENSE_WORDS.some((w) => text.includes(w))
  const gentle = !intense && GENTLE_WORDS.some((w) => text.includes(w))
  const wordMult = intense ? 1.3 : gentle ? 0.8 : 1
  const zv = zone ? girl.sensitivities?.[zone] : undefined
  const zoneMult = zv === undefined ? 1 : ZONE_PLEASURE_MULT[getSensitivityLevel(zv)]
  const just: string[] = []
  const step = (h: Heat, dA: number, dP: number, who: string): Heat => {
    let arousal = clamp(h.arousal + dA)
    let pleasure = clamp(h.pleasure + dP * (arousal >= 60 ? 1.2 : 1))
    let climaxes = h.climaxes
    if (pleasure >= HEAT_MAX) { climaxes += 1; pleasure = CLIMAX_RESET_PLEASURE; arousal = clamp(arousal - CLIMAX_AROUSAL_DROP); just.push(who) }
    return { arousal: r1(arousal), pleasure: r1(pleasure), climaxes }
  }
  const h = state.girls[girl.id] ?? { arousal: 0, pleasure: 0, climaxes: 0 }
  const g = step(h, STEP_AROUSAL[i] * (0.6 + girl.lewdness / 100), STEP_PLEASURE[i] * zoneMult * wordMult, girl.id)
  const trainer = step(state.guest, STEP_AROUSAL[i], STEP_PLEASURE[i] * TRAINER_PLEASURE_MULT * wordMult, 'guest')
  const together = state.together || (just.includes('guest') && just.length > 1)
  return { guest: trainer, girls: { [girl.id]: g }, justClimaxed: just, together }
}
