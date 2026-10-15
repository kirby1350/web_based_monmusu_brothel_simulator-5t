// 提示词的游戏状态片段：纯函数，只产出文本/标签，不改任何请求格式
import { getBodyTrait, bodyPrefHit } from './body-traits'
import { DENSE_LENGTH, DENSE_TURN_NOTE } from './prose-bank'
import type { ProseStyle } from './types'
import type { ChatMessage, GameSave, Guest, MonstGirl, OutfitId, ServingSkill, SkillKey, StockingId } from './types'
import {
  OUTFITS, STOCKINGS, RACE_TRAITS, RACE_PLAYS, RACE_ZONE_NAMES, TRAINING_PROPS, TRAINING_ROOM_MULT, SCULPT_POTIONS,
  getSkillRank, getSensitivityLevel, getInclination,
} from './catalog'
import { traitMatched } from './resolve-service'
import { proficiencyFromLegacy, profShow, profTierLabel, nextTier, DRILL_PROF_GAIN } from './proficiency'
import { resolveTraining, TRAINING_DIRECTIONS, type TrainingInput } from './resolve-training'
import { stripStatsBlock } from './game-engine'
import { DOMINANCE_VOICE } from './voice-prompts'
import { awakenedFetishes, getScene, sceneReaction, shadowScenes, shadowLevel, SHADOW_LEVEL_LABEL, REACTION_LABEL } from './scenes'
import type { SceneId } from './types'

/** 种族被动的一句效果（写进提示词，让叙述能体现） */
export const RACE_TRAIT_EFFECT: Record<string, string> = {
  忠犬: '服从低也肯接客', 魅惑: '偏好全不中也能迎客加分', 持久: '第二场体力消耗少', 柔体: '低体力惩罚减半',
  轻身: '身侍+2', 傲骨: '满意后收入×1.2', 敏感: '调教成长×1.25', 夜习: '当天第2、3场更出彩',
  反哺: '满意后回体力', 调剂: '塑形药效果×1.5', 怪力: '身侍+2', 乳侍: '天生会胸侍', 野性: '身侍+2',
}

const SERVING: ServingSkill[] = ['待客', '手技', '口侍', '胸侍', '身侍']

/** 1. 每位魔物娘的状态卡（替代旧「技能」行） */
/** private：调教 / 私下场合才带阴影；接客不带 */
export function girlStateCard(girl: MonstGirl, day?: number, opts: { private?: boolean } = {}): string {
  const prof = girl.proficiency ?? proficiencyFromLegacy(girl)
  const skills = SERVING.map((k) => { const r = getSkillRank(girl, k); return r ? `${k} ${r}(${profShow(prof[k])})` : '' }).filter(Boolean)
  const incl = getInclination(girl)
  const m = profShow(prof['M性']), sv = profShow(prof['S性'])
  const inclText = m || sv ? `${incl}（M ${m}/S ${sv}）` : incl
  const trait = RACE_TRAITS[girl.race]
  const zones = Object.entries(girl.sensitivities ?? {})
    .map(([z, v]) => ({ z, lv: getSensitivityLevel(v as number), v: v as number }))
    .filter((x) => x.lv === '敏感' || x.lv === '弱点')
    .sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${x.z === '种族' ? (RACE_ZONE_NAMES[girl.race] ?? '种族') : x.z} ${x.lv}`)
  const parts = [
    `技能：${skills.join('、') || '尚未学会'}`,
    `倾向：${inclText}`,
    trait ? `种族被动：${trait}（${RACE_TRAIT_EFFECT[trait] ?? ''}）` : '',
    zones.length ? `敏感：${zones.join('、')}` : '',
    girl.incident ? `事件：${girl.incident.kind}·${girl.incident.text}（未处理）` : '',
    girl.awakened?.length ? `觉醒性癖：${awakenedFetishes(girl).map((d) => d.fetish).join('、')}` : '',
    opts.private && shadowScenes(girl).length ? `阴影：${shadowScenes(girl).map((id) => getScene(id)!.name).join('、')}` : '',
    day ? `第${day}天` : '',
  ].filter(Boolean)
  return parts.join('｜')
}

/** 2. 调教上下文：方向+效果、道具效果、调教室等级与倍率、目标技能/药 */
export function trainingContext(input: TrainingInput): string {
  const dir = TRAINING_DIRECTIONS.find((d) => d.key === input.direction)
  const lv = Math.max(1, Math.min(4, input.roomLevel ?? 1))
  const preview = resolveTraining({ ...input, skip: true })
  let target = ''
  if (input.direction === 'drill' && input.skill) {
    const v = (input.girl.proficiency ?? proficiencyFromLegacy(input.girl))[input.skill as SkillKey] ?? 0
    const nt = nextTier(v)
    target = `｜目标：${input.skill}（${profTierLabel(v)} 熟练度 ${profShow(v)}${nt ? `，${nt.at} 升${nt.rank}` : ''}；每场约 +${DRILL_PROF_GAIN}）`
  } else if (input.direction === 'sculpt' && input.potionId) {
    const p = SCULPT_POTIONS.find((x) => x.id === input.potionId)
    if (p) target = `｜药：${p.name}（${p.stat} ${p.delta > 0 ? '+' : ''}${p.delta}）`
  } else if (input.direction === 'sensitize' && input.zone) target = `｜开发：${input.zone}`
  const propNotes = preview.ok ? preview.notes.filter((n) => TRAINING_PROPS.some((p) => n.startsWith(p.name)) || n.includes('：')) : []
  const props = (input.props ?? []).length ? `\n道具：${propNotes.join('、') || (input.props ?? []).join('、')}——请在叙述中实际使用这些道具` : ''
  return `【本次调教】${dir?.label ?? input.direction}（${dir?.hint ?? ''}）${target}｜调教室 Lv${lv}（×${TRAINING_ROOM_MULT[lv - 1]}）${props}${sceneContext(input)}${input.provoke ? provokeSection(input.girl, input.provoke) : ''}`
}

/** 调教场景段：场景描写 + 她的反应（亲和/抗拒/觉醒/阴影）；没有场景时空串 */
export function sceneContext(input: Pick<TrainingInput, 'girl' | 'scene'>): string {
  const def = getScene(input.scene)
  if (!def) return ''
  const g = input.girl
  const r = sceneReaction(g, def.id)
  const react = r === 'awakened' ? `她已觉醒「${def.fetish}」（${def.fetishDesc}），一进来就控制不住地期待`
    : r === 'affinity' ? `她是${g.race}，天生亲近这里，比别人更快沉进去`
    : r === 'aversion' ? `她是${g.race}，本能地抗拒这里：要写出她的害怕与挣扎，但不要让她崩坏`
    : '她第一次面对这样的地方时会紧张，身体却诚实'
  const lv = shadowLevel(g, def.id)
  const shadow = lv ? `；这里在她心里留有阴影（${SHADOW_LEVEL_LABEL[lv]}），会发抖、想逃` : ''
  const role = def.roleNote ? `\n${def.roleNote}；她仍是原来的性格、自称与口癖，只是多了${def.id === 'cradle' ? '母性' : '支配'}的一面` : ''
  const voice = DOMINANCE_VOICE[def.id] ? `\n${DOMINANCE_VOICE[def.id]}（用她自己的自称与语气说出来）` : ''
  return `\n【调教场景】${def.name}：${def.place}\n她的反应（${REACTION_LABEL[r] || '普通'}）：${react}${shadow}${role}——请让场景本身成为叙述的主角，道具与环境要被实际使用${voice}`
}

/**
 * 【激发阴影】段：对话里触到阴影（或跳过时掷中）后，本场剩下的回合都带着它。只进调教提示词。
 */
export function provokeSection(girl: Pick<MonstGirl, 'name'>, scene: SceneId): string {
  const def = getScene(scene)
  if (!def) return ''
  return `\n【激发阴影】馆主的话揭开了${girl.name}在${def.name}留下的阴影：从现在起写出她被唤起的恐惧、发抖与无力抵抗后的顺从（服从大幅上升）；她仍是原来的性格、自称与口癖，不要崩坏、不要恶堕，事后要有余悸`
}

/** 3. 客人偏好命中 */
export function guestPrefLine(guest: Guest, girl: MonstGirl, outfit: OutfitId = 'regular', stockings: StockingId = 'none'): string {
  const items: string[] = []
  if (guest.prefRace) items.push(`种族：${guest.prefRace} ${guest.prefRace === girl.race ? '✔' : '✘'}`)
  if (guest.prefTrait) items.push(`特征：${guest.prefTrait} ${traitMatched(guest, girl) ? '✔' : '✘'}`)
  if (guest.prefOutfit) {
    const o = OUTFITS.find((x) => x.id === outfit); const s = STOCKINGS.find((x) => x.id === stockings)
    const hit = o?.pref === guest.prefOutfit || s?.pref === guest.prefOutfit
    items.push(`服装：${guest.prefOutfit} ${hit ? `✔（已换上${hit && s?.pref === guest.prefOutfit ? s.name : o!.name}）` : '✘'}`)
  }
  if (guest.prefBody) items.push(`体质：${getBodyTrait(guest.prefBody)?.name ?? guest.prefBody} ${bodyPrefHit(guest, girl) ? '✔' : '✘'}`)
  if (!items.length) return ''
  return `【客人偏好】${items.join('｜')}——命中项要被客人点名称赞，未命中项写出他的挑剔`
}

/** 4. 历史裁剪：去掉旧助手消息的 STATS/ACTIONS（保留最新一条做格式示范），只留最后 keep 轮，前面压成一行前情 */
export function trimHistory(messages: ChatMessage[], keep = 6, recap?: string): ChatMessage[] {
  const lastAssistant = messages.map((m) => m.role).lastIndexOf('assistant')
  const cleaned = messages.map((m, i) => (m.role === 'assistant' && i !== lastAssistant ? { ...m, content: stripStatsBlock(m.content) } : m))
  // 一轮 = 一条 user + 其后的 assistant；从末尾数 keep 条 user 消息
  let users = 0, cut = 0
  for (let i = cleaned.length - 1; i >= 0; i--) {
    if (cleaned[i].role === 'user' && ++users === keep) { cut = i; break }
  }
  if (users < keep || cut === 0) return cleaned
  const dropped = cleaned.slice(0, cut)
  const line = recap || `【前情】已进行 ${dropped.filter((m) => m.role === 'user').length} 轮：` +
    dropped.filter((m) => m.role === 'user' && !m.hidden).map((m) => m.content.slice(0, 12)).join(' → ')
  return [{ role: 'user', content: line }, { role: 'assistant', content: '（继续）' }, ...cleaned.slice(cut)]
}

/** 6. 按当前状态拼图片标签（替换服装 tag，加状态 tag），最多 cap 个 */
export function contextImageTags(girl: MonstGirl, ctx: { outfit?: OutfitId; stockings?: StockingId; exhausted?: boolean; incident?: boolean; scene?: 'service' | 'training'; trainingScene?: SceneId } = {}, cap = 40): string {
  const split = (s?: string) => (s ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  const o = OUTFITS.find((x) => x.id === ctx.outfit)
  const st = STOCKINGS.find((x) => x.id === ctx.stockings)
  const outfitTags = new Set(split(girl.outfitTags).map((t) => t.toLowerCase()))
  let base = split(girl.imageTags)
  if (o?.tags) base = base.filter((t) => !outfitTags.has(t.toLowerCase()))
  const extra = [
    ...split(o?.tags), ...split(st?.tags),
    ...(ctx.exhausted ? ['sweat', 'heavy breathing', 'exhausted'] : []),
    ...(ctx.incident ? ['nervous', 'looking away'] : []),
    ...(ctx.scene === 'training' ? (getScene(ctx.trainingScene) ? split(getScene(ctx.trainingScene)!.tags) : ['dungeon', 'restrained']) : ctx.scene === 'service' ? ['bedroom', 'dim lighting'] : []),
  ]
  // 质量词（masterpiece 等）放最后保底，去重后截断
  const quality = base.filter((t) => /masterpiece|best quality|highly detailed|^anime$/i.test(t))
  const body = base.filter((t) => !quality.includes(t))
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...body, ...extra]) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t) } }
  const q = quality.filter((t) => !seen.has(t.toLowerCase()))
  return [...out.slice(0, Math.max(0, cap - q.length)), ...q].slice(0, cap).join(', ')
}

/** 7. 第 2 天起开场白的馆内近况 */
export function houseStateLines(save: GameSave): string {
  const lines: string[] = []
  const inc = save.girls.filter((g) => g.incident)
  if (inc.length) lines.push(inc.map((g) => `${g.name}${g.incident!.kind}（${g.incident!.text}），一脸心虚`).join('；'))
  const tired = save.girls.filter((g) => g.exhausted || (g.stamina ?? 100) < 30).map((g) => g.name)
  if (tired.length) lines.push(`${tired.join('、')}体力不支`)
  const p = save.player
  const fac = [['宿舍', p.dormLevel], ['接客间', p.serviceRoomLevel], ['调教室', p.trainingRoomLevel]].filter(([, v]) => (v as number) > 1)
  if (fac.length) lines.push(fac.map(([n, v]) => `${n} Lv${v}`).join('、'))
  if (save.regulars?.length) lines.push(`回头客 ${save.regulars.length} 位`)
  // 昨天经历最多的那位的心里话（最多一人，截断）
  const y = save.currentDay - 1
  const mood = save.girls.filter((g) => g.memory?.summary && g.memory.events.some((e) => e.day === y))
    .sort((a, b) => (b.memory!.events.filter((e) => e.day === y).length - a.memory!.events.filter((e) => e.day === y).length))[0]
  if (mood) lines.push(`${mood.name}的心事：${mood.memory!.summary.slice(0, 40)}`)
  return lines.length ? `【馆内近况】${lines.join('｜')}` : ''
}

/** 8. 合法种族列表：有被动 / 专属 play / 种族敏感带的种族并集 */
export const VALID_RACES = [...new Set([...Object.keys(RACE_TRAITS), ...Object.keys(RACE_PLAYS), ...Object.keys(RACE_ZONE_NAMES)])]

/** 大厅第 2 天起的开场白：已缓存当天的就不再请求；返回要发给模型的提示词或 null */
export async function hubOpeningPrompt(save: GameSave, cachedDay: number | null): Promise<string | null> {
  if (save.currentDay < 2 || cachedDay === save.currentDay) return null
  const { buildOpeningDialoguePrompt } = await import('./prompt-builder')
  return buildOpeningDialoguePrompt('game-start', save.player, save.girls, { currentDay: save.currentDay, house: houseStateLines(save) })
}

export interface RecapStep { label: string; score: number; max: number; turns: number; key?: string }

/** 历史裁剪的前情：每个已走过的步骤写「步骤 分/满·关键动作」，当前步骤标进行中；最多两行 */
export function buildStepRecap(steps: RecapStep[], currentIndex: number): string {
  const done = steps.slice(0, currentIndex).map((s) => `${s.label} ${s.score}/${s.max}${s.key ? `·${s.key}` : ''}${s.turns ? '' : '（跳过）'}`)
  const cur = steps[currentIndex]
  const parts = [...done, ...(cur ? [`${cur.label} 进行中（已写 ${cur.turns} 回合）`] : [])]
  const half = Math.ceil(parts.length / 2)
  const line = parts.length > 3 ? `${parts.slice(0, half).join(' → ')}\n→ ${parts.slice(half).join(' → ')}` : parts.join(' → ')
  return `【前情】${line}`
}

/** 每回合附在玩家消息末尾（只进请求，不进界面/存档）的字数提醒 */
export const REPLY_LENGTH = { min: 300, max: 500 }
export function lengthReminder(kind: 'service' | 'training' | 'chat', style: ProseStyle = 'standard'): string {
  const dense = style === 'dense' && kind !== 'chat'
  const { min, max } = dense ? DENSE_LENGTH : REPLY_LENGTH
  if (kind === 'chat') return `\n\n（回复要求：${min}–${max} 字。以她的话语为主，穿插她的动作、神态与心里的小念头，分两三段写，不要只回一两句。）`
  return `\n\n（本回合要求：正文 ${min}–${max} 字（不含数据块），分三到五段，写足动作、对白和身体反应，不要只写一两句；末尾照常附 STATS 与 ACTIONS 两行。）${dense ? DENSE_TURN_NOTE : ''}`
}
/** 把字数提醒接到最后一条玩家消息上（只改请求内容） */
export function withTurnSuffix(messages: ChatMessage[], suffix?: string): ChatMessage[] {
  if (!suffix) return messages
  const i = messages.map((m) => m.role).lastIndexOf('user')
  return i < 0 ? messages : messages.map((m, j) => (j === i ? { ...m, content: m.content + suffix } : m))
}

/** 5. 自动转场：进入下一步时发给模型的隐藏指令（同一个聊天请求格式），失败时用本地一句 */
export interface TransitionInput {
  from: string
  to: string
  action: string
  girls: string[]
  guest: string
  /** 兴奋/快感档位的一行摘要（可空） */
  heatLine?: string
  final?: boolean
}
export function transitionTurn(t: TransitionInput): string {
  return `（转场：从「${t.from}」进入「${t.to}」。这一步的做法：${t.action}。` +
    `请用旁白加对白自然写出这次转换：${t.girls.join('、')}怎样把气氛从上一步顺势推进到「${t.to}」，${t.guest}有什么反应` +
    `${t.heatLine ? `；此刻 ${t.heatLine}，说话与身体反应要符合这个状态` : ''}。` +
    `人物保持各自的自称与口癖。这是自动转场，不要替馆主做决定，写到「${t.to}」刚开始、留给馆主接下去为止。）`
}
export function transitionFallback(t: TransitionInput): string {
  const who = t.girls.join('和')
  return `——${who}${t.from === '迎客' ? '把' + t.guest + '引到床边' : '没有停下'}，顺势${t.action.replace(/[。！!]$/, '')}。「${t.to}」开始了。`
}

// ─── 本地回看上一条回复：越过高潮闸门时，下一回合附一句校正（不自动重写、不自动续写） ───
// 只认「已经发生」的说法；「要射了」「射进来吧」这类濒临/邀请不算
const GUEST_CLIMAX_RE = /(射了出来|射了进去|射进了|射在了|射满了|射了[一好满个]|内射了|灌满了|精液(?:喷涌|涌出|灌进|溢出|射出|喷射)|一股股[^。！？]{0,8}精液|射精的余韵)/
const GIRL_CLIMAX_RE = /(潮吹(?:了|而出|不止|如注)|喷出了潮|高潮了|达到了?高潮|迎来了?高潮|绝顶了|(?<![要快就])去了[❤♡！!～~]|一起去了)/
/** 上一条回复写了不该写的高潮：返回下一回合要附的校正句；没越界返回空串 */
export function climaxSlipNote(reply: string, justClimaxed: string[], hasGuest = true): string {
  const text = reply.replace(/<!--[\s\S]*?-->/g, '')
  const guestSlip = hasGuest && !justClimaxed.includes('guest') && GUEST_CLIMAX_RE.test(text)
  const girlSlip = !justClimaxed.some((id) => id !== 'guest') && GIRL_CLIMAX_RE.test(text)
  if (!guestSlip && !girlSlip) return ''
  return `\n（校正：上一段在没有到「高潮」档时写了${guestSlip ? '射精' : ''}${guestSlip && girlSlip ? '与' : ''}${girlSlip ? '她的高潮' : ''}。这一段请顺势圆回来——是差一点、被忍住或被拉回，不要再写；严格按【此刻的兴奋与快感】里的高潮闸门。）`
}

/** 服装行：换了店里的服装 → 用目录里的描写取代她的常服；只加丝袜 → 常服 + 丝袜描写；什么都没换 → 她的常服 */
export function outfitDescLine(girl: Pick<MonstGirl, 'outfit'>, outfit: OutfitId | undefined, stockings: StockingId | undefined): string {
  const o = outfit && outfit !== 'regular' ? OUTFITS.find((x) => x.id === outfit) : undefined
  const s = stockings && stockings !== 'none' ? STOCKINGS.find((x) => x.id === stockings) : undefined
  const trim = (t?: string) => (t ?? '').replace(/[。．.]$/, '')
  const legs = s ? `；腿上：${s.name}——${trim(s.desc)}` : ''
  if (!o) return `${girl.outfit}${legs}`
  return `今晚换上的「${o.name}」——${trim(o.desc)}${legs}（这是她此刻身上的衣服，不要再写她的常服「${girl.outfit}」）`
}

/** 客人对服装的反应提示：喜好命中 → 点名评论这身衣服；有喜好但没命中 → 轻微挑剔；无喜好 → 空 */
export function outfitCommentLine(guest: Guest, outfit: OutfitId | undefined, stockings: StockingId | undefined): string {
  if (!guest.prefOutfit) return ''
  const o = OUTFITS.find((x) => x.id === (outfit ?? 'regular')); const s = STOCKINGS.find((x) => x.id === (stockings ?? 'none'))
  const hit = o?.pref === guest.prefOutfit ? o : s?.pref === guest.prefOutfit ? s : undefined
  return hit
    ? `【服装反应】${guest.name}偏爱「${guest.prefOutfit}」，她正穿着「${hit.name}」：让他具体地评论这身——布料、开衩、哪一处最合他心意，并在动作里用上它（拉开、撩起、隔着它抚摸）`
    : `【服装反应】${guest.name}偏爱「${guest.prefOutfit}」，她没穿：他可以提一句、略带遗憾或挑剔，但不要喧宾夺主`
}

// ─── 防重复：本地记最近用过的比喻与玩法 ─────────────────────────────────────────
const METAPHOR_RE = /(?:像|宛如|仿佛|如同|好似|犹如)([^，。！？、…\n「」『』（）《》,.!?]{1,10}?)(?:一样|一般|般|似的)/g
/** 从一段回复里抽出比喻的喻体（「像融化的黄油一样」→「融化的黄油」） */
export function extractMetaphors(text: string): string[] {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '')
  const out: string[] = []
  for (const m of clean.matchAll(METAPHOR_RE)) { const w = m[1].trim(); if (w.length >= 2 && !out.includes(w)) out.push(w) }
  return out
}
/** 最近的喻体只留 max 个（新的在后） */
export function pushRecent(prev: string[], add: string[], max = 10): string[] {
  const next = [...prev.filter((x) => !add.includes(x)), ...add]
  return next.slice(-max)
}
/** 【最近已用，避免重复】行；都没有时空串 */
export function recentUseLine(metaphors: string[], plays: string[]): string {
  const parts = [metaphors.length ? `比喻/喻体：${metaphors.join('、')}` : '', plays.length ? `已写过的玩法：${plays.join('、')}` : ''].filter(Boolean)
  return parts.length ? `【最近已用，避免重复】${parts.join('；')}——这一段换新的比喻与动作，已写过的玩法除非玩家点名，不要原样再来一遍` : ''
}

// ─── 篇幅回看：上一段明显偏短，下一回合提醒写长（不自动续写） ───────────────────
export function visibleLength(reply: string): number {
  return reply.replace(/<!--[\s\S]*?-->/g, '').replace(/\s/g, '').length
}
export function shortReplyNote(reply: string, style: ProseStyle = 'standard'): string {
  const n = visibleLength(reply)
  const { min, max } = style === 'dense' ? DENSE_LENGTH : REPLY_LENGTH
  return n > 0 && n < min ? `\n（上一段正文只有约 ${n} 字，偏短：这一段请写足 ${min}–${max} 字，动作、对白、反应都要展开。）` : ''
}
