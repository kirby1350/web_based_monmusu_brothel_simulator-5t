// 提示词的游戏状态片段：纯函数，只产出文本/标签，不改任何请求格式
import type { ChatMessage, GameSave, Guest, MonstGirl, OutfitId, ServingSkill, SkillKey, StockingId } from './types'
import {
  OUTFITS, STOCKINGS, RACE_TRAITS, RACE_PLAYS, RACE_ZONE_NAMES, TRAINING_PROPS, TRAINING_ROOM_MULT, SCULPT_POTIONS, SKILL_PROGRESS_PER_RANK,
  getSkillRank, getSensitivityLevel, getInclination,
} from './catalog'
import { traitMatched } from './resolve-service'
import { resolveTraining, TRAINING_DIRECTIONS, type TrainingInput } from './resolve-training'
import { stripStatsBlock } from './game-engine'

/** 种族被动的一句效果（写进提示词，让叙述能体现） */
export const RACE_TRAIT_EFFECT: Record<string, string> = {
  忠犬: '服从低也肯接客', 魅惑: '偏好全不中也能迎客加分', 持久: '第二场体力消耗少', 柔体: '低体力惩罚减半',
  轻身: '身侍+2', 傲骨: '满意后收入×1.2', 敏感: '调教成长×1.25', 夜习: '当天第2、3场更出彩',
  反哺: '满意后回体力', 调剂: '塑形药效果×1.5', 怪力: '身侍+2', 乳侍: '天生会胸侍', 野性: '身侍+2',
}

const SERVING: ServingSkill[] = ['待客', '手技', '口侍', '胸侍', '身侍']

/** 1. 每位魔物娘的状态卡（替代旧「技能」行） */
export function girlStateCard(girl: MonstGirl, day?: number): string {
  const skills = SERVING.map((k) => { const r = getSkillRank(girl, k); return r ? `${k} ${r}` : '' }).filter(Boolean)
  const incl = getInclination(girl)
  const ms = girl.msProgress
  const inclText = incl === '无' ? (ms && (ms.m || ms.s) ? `无（M${ms.m}/S${ms.s}）` : '无') : incl
  const trait = RACE_TRAITS[girl.race]
  const zones = Object.entries(girl.sensitivities ?? {})
    .map(([z, v]) => ({ z, lv: getSensitivityLevel(v as number), v: v as number }))
    .filter((x) => x.lv === '敏感' || x.lv === '弱点')
    .sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${x.z === '种族' ? (RACE_ZONE_NAMES[girl.race] ?? '种族') : x.z} ${x.lv}`)
  const legacy = girl.skills.length ? `｜招牌：${girl.skills.join('、')}` : ''
  const parts = [
    `技能：${skills.join('、') || '尚未学会'}`,
    `倾向：${inclText}`,
    trait ? `种族被动：${trait}（${RACE_TRAIT_EFFECT[trait] ?? ''}）` : '',
    zones.length ? `敏感：${zones.join('、')}` : '',
    girl.incident ? `事件：${girl.incident.kind}·${girl.incident.text}（未处理）` : '',
    day ? `第${day}天` : '',
  ].filter(Boolean)
  return parts.join('｜') + legacy
}

/** 2. 调教上下文：方向+效果、道具效果、调教室等级与倍率、目标技能/药 */
export function trainingContext(input: TrainingInput): string {
  const dir = TRAINING_DIRECTIONS.find((d) => d.key === input.direction)
  const lv = Math.max(1, Math.min(4, input.roomLevel ?? 1))
  const preview = resolveTraining({ ...input, skip: true })
  let target = ''
  if (input.direction === 'drill' && input.skill) {
    const rank = getSkillRank(input.girl, input.skill as SkillKey) ?? '未学'
    target = `｜目标：${input.skill}（${rank} ${input.girl.skillProgress?.[input.skill as SkillKey] ?? 0}/${SKILL_PROGRESS_PER_RANK}）`
  } else if (input.direction === 'sculpt' && input.potionId) {
    const p = SCULPT_POTIONS.find((x) => x.id === input.potionId)
    if (p) target = `｜药：${p.name}（${p.stat} ${p.delta > 0 ? '+' : ''}${p.delta}）`
  } else if (input.direction === 'sensitize' && input.zone) target = `｜开发：${input.zone}`
  const propNotes = preview.ok ? preview.notes.filter((n) => TRAINING_PROPS.some((p) => n.startsWith(p.name)) || n.includes('：')) : []
  const props = (input.props ?? []).length ? `\n道具：${propNotes.join('、') || (input.props ?? []).join('、')}——请在叙述中实际使用这些道具` : ''
  return `【本次调教】${dir?.label ?? input.direction}（${dir?.hint ?? ''}）${target}｜调教室 Lv${lv}（×${TRAINING_ROOM_MULT[lv - 1]}）${props}`
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
    dropped.filter((m) => m.role === 'user').map((m) => m.content.slice(0, 12)).join(' → ')
  return [{ role: 'user', content: line }, { role: 'assistant', content: '（继续）' }, ...cleaned.slice(cut)]
}

/** 6. 按当前状态拼图片标签（替换服装 tag，加状态 tag），最多 cap 个 */
export function contextImageTags(girl: MonstGirl, ctx: { outfit?: OutfitId; stockings?: StockingId; exhausted?: boolean; incident?: boolean; scene?: 'service' | 'training' } = {}, cap = 40): string {
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
    ...(ctx.scene === 'training' ? ['dungeon', 'restrained'] : ctx.scene === 'service' ? ['bedroom', 'dim lighting'] : []),
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
  return lines.length ? `【馆内近况】${lines.join('｜')}` : ''
}

/** 8. 合法种族列表：有被动 / 专属 play / 种族敏感带的种族并集 */
export const VALID_RACES = [...new Set([...Object.keys(RACE_TRAITS), ...Object.keys(RACE_PLAYS), ...Object.keys(RACE_ZONE_NAMES)])]
