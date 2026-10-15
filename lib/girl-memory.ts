// 魔物娘自己的记忆（纯函数）：结算时确定性地记事件（不依赖 AI），每晚压缩/遗忘并写一段本地「心里话」；
// 新的一天每人最多一次非流式 /api/chat 改写心里话（请求格式同「保存为常客」），失败保留本地版。
import type { GameSave, Guest, MonstGirl, Player, SceneId } from './types'
import type { TrainingResult } from './resolve-training'
import { getScene } from './scenes'
import { parseLooseJson } from './utils'

export type MemoryKind = 'first' | 'arrival' | 'training' | 'service' | 'gift' | 'incident' | 'punish' | 'quote' | 'milestone' | 'awaken' | 'shadow'
/** 只在调教 / 私下聊天里回想的事（阴影）；接客、馆内开场、心里话都不带 */
export const PRIVATE_KINDS: MemoryKind[] = ['shadow']
const isPrivate = (e: Pick<MemoryEvent, 'kind'>) => PRIVATE_KINDS.includes(e.kind)
export interface MemoryEvent { day: number; kind: MemoryKind; text: string; w: 1 | 2 | 3; guestId?: string; scene?: SceneId }
export interface GuestTally { name: string; count: number; bestSat: number }
export interface GirlMemory {
  events: MemoryEvent[]
  /** 她第一人称的「心里话」（滚动摘要） */
  summary: string
  /** 摘要覆盖到第几天 */
  summaryDay: number
  /** 当天已尝试过 AI 摘要（成功或失败都记，刷新不重复） */
  aiDay?: number
  /** 馆主让她记住的话 */
  quotes: { day: number; text: string }[]
  guestTally: Record<string, GuestTally>
  /** 已记过的「第一次」与里程碑 key（只记一次） */
  firsts: string[]
  milestones: string[]
  /** 送过的礼物档（第一次送某档额外 +2）与上一次送礼 */
  giftTiers: number[]
  lastGift?: { tier: number; day: number }
}

export const MAX_EVENTS = 40
export const MAX_PERMANENT = 15
export const EVENT_TEXT_MAX = 40
export const SUMMARY_MAX = 200
export const MAX_QUOTES = 5
export const QUOTE_MAX = 30
export const MAX_TALLY = 5
export const FORGET_DAYS: Record<1 | 2, number> = { 1: 14, 2: 30 }
export const PROMPT_BLOCK_MAX = 300
export const GIFT_FIRST_BONUS = 2
export const GIFT_REPEAT_DAYS = 3
export const GIFT_REPEAT_MULT = 0.7
export const REGULAR_GREET_BONUS = 2
export const REGULAR_MIN_COUNT = 3
export const REGULAR_MIN_SAT = 70
export const MILESTONES = [30, 50, 70, 90]

export function emptyMemory(): GirlMemory {
  return { events: [], summary: '', summaryDay: 0, quotes: [], guestTally: {}, firsts: [], milestones: [], giftTiers: [] }
}

export const memOf = (g: Pick<MonstGirl, 'memory'>): GirlMemory => ({ ...emptyMemory(), ...(g.memory ?? {}) })
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const withMem = (g: MonstGirl, m: GirlMemory): MonstGirl => ({ ...g, memory: m })

/** 淘汰：超上限时先删 w 低、再删旧的；永久（w3）最多 MAX_PERMANENT 条 */
function enforceCaps(events: MemoryEvent[]): MemoryEvent[] {
  let ev = [...events]
  const perm = ev.filter((e) => e.w === 3)
  if (perm.length > MAX_PERMANENT) {
    const drop = new Set(perm.slice(0, perm.length - MAX_PERMANENT))
    ev = ev.filter((e) => !drop.has(e))
  }
  while (ev.length > MAX_EVENTS) {
    const minW = Math.min(...ev.map((e) => e.w))
    const idx = ev.findIndex((e) => e.w === minW)
    ev.splice(idx, 1)
  }
  return ev
}

export function addEvent(g: MonstGirl, e: MemoryEvent): MonstGirl {
  const m = memOf(g)
  return withMem(g, { ...m, events: enforceCaps([...m.events, { ...e, text: cut(e.text, EVENT_TEXT_MAX) }]) })
}

/** 「第一次」：key 没记过才记（w3） */
export function markFirst(g: MonstGirl, key: string, day: number, text: string, extra: Partial<MemoryEvent> = {}): MonstGirl {
  const m = memOf(g)
  if (m.firsts.includes(key)) return g
  const next = withMem(g, { ...m, firsts: [...m.firsts, key] })
  return addEvent(next, { day, kind: 'first', text, w: 3, ...extra })
}

// ─── 结算钩子 ─────────────────────────────────────────────────────────────────

const DIR_LABEL: Record<string, string> = { tame: '驯服', release: '放权', sculpt: '塑形', drill: '特训', sensitize: '敏感开发', punish: '惩罚' }

/** 一场调教：普通事件 + 第一次调教/第一次进某场景/觉醒/升档/两面/处理事件 */
export function recordTraining(after: MonstGirl, before: MonstGirl, result: TrainingResult, day: number): MonstGirl {
  if (!result.ok) return after
  const sc = getScene(result.scene)
  const dir = DIR_LABEL[result.direction ?? ''] ?? '调教'
  const d = result.delta
  const gains = [d.obedience && `服从+${d.obedience}`, d.lewdness && `淫乱+${d.lewdness}`, d.affection && `好感${d.affection > 0 ? '+' : ''}${d.affection}`].filter(Boolean).join(' ')
  let g = after
  if (result.scene === 'hypnosis') {
    g = addEvent(g, { day, kind: 'training', text: '（记忆模糊）像在催眠室里做了一场很长的梦', w: 1, scene: 'hypnosis' })
  } else if (result.direction === 'punish' && before.incident) {
    g = addEvent(g, { day, kind: 'punish', text: `因为${before.incident.text}被罚${sc ? `进${sc.name}` : ''}`, w: 2, ...(sc ? { scene: sc.id } : {}) })
  } else {
    g = addEvent(g, { day, kind: 'training', text: `${sc ? sc.name + '·' : ''}${dir}${gains ? '，' + gains : ''}`, w: 1, ...(sc ? { scene: sc.id } : {}) })
  }
  g = markFirst(g, 'training', day, `第${day}天第一次被馆主调教（${dir}）`)
  if (sc) g = markFirst(g, `scene:${sc.id}`, day, `第${day}天第一次被带进${sc.name}`, { scene: sc.id })
  if (result.awakenedScene) {
    const a = getScene(result.awakenedScene)!
    g = markFirst(g, `awaken:${a.id}`, day, `第${day}天在${a.name}里觉醒了${a.fetish}`, { scene: a.id, kind: 'awaken' })
  }
  if (result.shadowScene) g = addEvent(g, { day, kind: 'shadow', text: `${getScene(result.shadowScene)!.name}成了她心里的阴影`, w: 2, scene: result.shadowScene })
  if (result.provokedScene) g = addEvent(g, { day, kind: 'shadow', text: `${getScene(result.provokedScene)!.name}的阴影被揭开，抖着顺从了`, w: 2, scene: result.provokedScene })
  if (result.newRank) g = addEvent(g, { day, kind: 'milestone', text: `技能练到了「${result.newRank}」`, w: 2 })
  if (result.becameTwoSided) g = markFirst(g, 'two-sided', day, `第${day}天成为了「两面」`)
  return g
}

/** 一场接客：普通事件（极乐/不满记重一点）+ 熟客统计 + 第一次接客 */
export function recordService(g: MonstGirl, guest: Guest, info: { tier: string; sat: number; reward: number }, day: number): MonstGirl {
  const w: 1 | 2 = info.tier === '极乐' || info.tier === '不满' ? 2 : 1
  let next = addEvent(g, { day, kind: 'service', text: `接待${guest.name}，评价「${info.tier}」（${info.sat}）`, w, guestId: guest.id })
  next = markFirst(next, 'service', day, `第${day}天第一次接客，对象是${guest.name}`, { guestId: guest.id })
  const m = memOf(next)
  const cur = m.guestTally[guest.id] ?? { name: guest.name, count: 0, bestSat: 0 }
  const tally = { ...m.guestTally, [guest.id]: { name: guest.name, count: cur.count + 1, bestSat: Math.max(cur.bestSat, info.sat) } }
  const top = Object.entries(tally).sort((a, b) => b[1].count - a[1].count || b[1].bestSat - a[1].bestSat).slice(0, MAX_TALLY)
  return withMem(next, { ...m, guestTally: Object.fromEntries(top) })
}

/** 送礼的好感：第一次送这档 +2；同档 3 天内重复只有七成 */
export function giftAffection(g: MonstGirl, tier: number, base: number, day: number): { value: number; note?: string } {
  const m = memOf(g)
  if (!m.giftTiers.includes(tier)) return { value: base + GIFT_FIRST_BONUS, note: `她记得这是你第一次送这样的礼物，好感再 +${GIFT_FIRST_BONUS}` }
  if (m.lastGift && m.lastGift.tier === tier && day - m.lastGift.day <= GIFT_REPEAT_DAYS) return { value: Math.round(base * GIFT_REPEAT_MULT), note: '同样的礼物前几天刚送过，她没那么惊喜了' }
  return { value: base }
}

export function recordGift(g: MonstGirl, tier: number, name: string, day: number): MonstGirl {
  const m = memOf(g)
  const next = withMem(g, { ...m, giftTiers: m.giftTiers.includes(tier) ? m.giftTiers : [...m.giftTiers, tier], lastGift: { tier, day } })
  return addEvent(next, { day, kind: 'gift', text: `馆主送了她${name}`, w: 2 })
}

export function recordQuote(g: MonstGirl, text: string, day: number): MonstGirl {
  const t = cut(text.replace(/\s+/g, ' ').trim(), QUOTE_MAX)
  if (!t) return g
  const m = memOf(g)
  if (m.quotes.some((q) => q.text === t)) return g
  const quotes = [...m.quotes, { day, text: t }].slice(-MAX_QUOTES)
  return addEvent(withMem(g, { ...m, quotes }), { day, kind: 'quote', text: `馆主对她说：「${t}」`, w: 3 })
}

export function removeQuote(g: MonstGirl, text: string): MonstGirl {
  const m = memOf(g)
  return withMem(g, { ...m, quotes: m.quotes.filter((q) => q.text !== text), events: m.events.filter((e) => !(e.kind === 'quote' && e.text.includes(text))) })
}

export function removeEvent(g: MonstGirl, index: number): MonstGirl {
  const m = memOf(g)
  return withMem(g, { ...m, events: m.events.filter((_, i) => i !== index) })
}

/** 熟客：接过 ≥3 次且最好一次 ≥70 → 迎客 +2 */
export function regularBonus(g: Pick<MonstGirl, 'memory'>, guest: Pick<Guest, 'id'>): number {
  const t = g.memory?.guestTally?.[guest.id]
  return t && t.count >= REGULAR_MIN_COUNT && t.bestSat >= REGULAR_MIN_SAT ? REGULAR_GREET_BONUS : 0
}

// ─── 存档级同步（入馆、里程碑、新事件）：在每次存档变化时调用 ─────────────────

const STAT_MS: [keyof Pick<MonstGirl, 'affection' | 'obedience' | 'lewdness'>, string][] = [['affection', '好感'], ['obedience', '服从'], ['lewdness', '淫乱']]
const MS_FLAVOR: Record<string, Record<number, string>> = {
  affection: { 30: '开始愿意和馆主说心里话', 50: '会偷偷等馆主回来', 70: '开始依恋馆主', 90: '把馆主当成最重要的人' },
  obedience: { 30: '不再顶嘴', 50: '习惯了听从命令', 70: '一个眼神就会照做', 90: '完全臣服于馆主' },
  lewdness: { 30: '身体开始有了反应', 50: '会主动想要', 70: '一碰就湿', 90: '满脑子都是那种事' },
}

export function milestonesCrossed(before: MonstGirl, after: MonstGirl): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = []
  const done = memOf(after).milestones
  for (const [k, label] of STAT_MS) {
    for (const t of MILESTONES) {
      const key = `${k}${t}`
      if (before[k] < t && after[k] >= t && !done.includes(key)) out.push({ key, text: `${label}到了${t}——${MS_FLAVOR[k][t]}` })
    }
  }
  return out
}

/** 比较前后存档：新入馆、数值里程碑、新挂上的事件 → 写进各自的记忆 */
export function syncMemory(prev: GameSave | null, next: GameSave): GameSave {
  const day = next.currentDay
  let changed = false
  const girls = next.girls.map((g) => {
    const b = prev?.girls.find((x) => x.id === g.id)
    let n = g
    if (!b) {
      if (memOf(g).firsts.includes('arrival')) return g
      const host = next.girls.filter((x) => x.id !== g.id).sort((x, y) => y.affection - x.affection)[0]
      n = markFirst(n, 'arrival', day, `第${day}天被馆主买下带回娼馆${host ? `，${host.name}来迎接` : ''}`, { kind: 'arrival' })
      changed = true
      return n
    }
    for (const ms of milestonesCrossed(b, n)) {
      const m = memOf(n)
      n = addEvent(withMem(n, { ...m, milestones: [...m.milestones, ms.key] }), { day, kind: 'milestone', text: ms.text, w: 2 })
      changed = true
    }
    if (n.incident && (!b.incident || b.incident.text !== n.incident.text || b.incident.day !== n.incident.day)) {
      n = addEvent(n, { day: n.incident.day, kind: 'incident', text: n.incident.text, w: 2 })
      changed = true
    }
    return n
  })
  return changed ? { ...next, girls } : next
}

// ─── 每晚：遗忘、压缩、本地心里话 ─────────────────────────────────────────────

export function compactMemory(g: MonstGirl, day: number): MonstGirl {
  if (!g.memory) return g
  const m = memOf(g)
  const events = m.events.filter((e) => e.w === 3 || day - e.day < FORGET_DAYS[e.w])
  const hadToday = m.events.some((e) => e.day === day)
  return withMem(g, { ...m, events, ...(hadToday ? { summary: localSummary({ ...g, memory: { ...m, events } }), summaryDay: day } : {}) })
}

/** 本地兜底的心里话：好感档的语气 + 分量最重的两三件事 */
export function localSummary(g: MonstGirl): string {
  const m = memOf(g)
  if (!m.events.length && !m.quotes.length) return ''
  const mood = g.affection >= 70 ? '一想到馆主心里就暖暖的' : g.affection >= 40 ? '对馆主说不上讨厌，偶尔也会想起他' : '还是有点怕馆主，但也开始习惯这里了'
  const key = m.events.filter((e) => !isPrivate(e)).sort((a, b) => b.w - a.w || b.day - a.day).slice(0, 3).map((e) => e.text.replace(/^第\d+天/, ''))
  const q = m.quotes.length ? `；忘不了那句「${m.quotes[m.quotes.length - 1].text}」` : ''
  return cut(`${mood}。记得：${key.join('；')}${q}`, SUMMARY_MAX)
}

// ─── 进提示词 ─────────────────────────────────────────────────────────────────

export interface MemoryContext { type: 'service' | 'training' | 'interaction' | 'hub'; guestId?: string; scene?: SceneId }

export function selectForPrompt(g: MonstGirl, ctx: MemoryContext, n = 3): MemoryEvent[] {
  // 阴影只在调教 / 私下聊天里回想
  const ev = memOf(g).events.filter((e) => !isPrivate(e) || ctx.type === 'training' || ctx.type === 'interaction')
  const score = (e: MemoryEvent): number => {
    let s = e.w * 2 + e.day / 1000
    if (ctx.type === 'training' && ['training', 'punish', 'first', 'awaken', 'shadow'].includes(e.kind)) s += 3
    if (ctx.scene && e.scene === ctx.scene) s += 5
    if (ctx.type === 'service' && ctx.guestId && e.guestId === ctx.guestId) s += 6
    if (ctx.type === 'interaction' && ['gift', 'quote', 'milestone'].includes(e.kind)) s += 3
    if (e.kind === 'quote') s -= 4 // 馆主的话单独一行
    return s
  }
  return [...ev].sort((a, b) => score(b) - score(a)).slice(0, n)
}

/** 【她的记忆】段：没有记忆时返回空串（提示词与旧版逐字一致） */
export function girlMemoryBlock(g: MonstGirl, ctx: MemoryContext, indent = ''): string {
  const m = memOf(g)
  if (!m.events.length && !m.summary && !m.quotes.length) return ''
  const lines: string[] = []
  if (m.summary) lines.push(`心里话：${m.summary}`)
  const picked = selectForPrompt(g, ctx).filter((e) => e.kind !== 'quote')
  if (picked.length) lines.push(`相关往事：${picked.map((e) => (/^第\d+天/.test(e.text) ? e.text : `第${e.day}天${e.text}`)).join('；')}`)
  if (m.quotes.length) lines.push(`馆主说过：${m.quotes.slice(-2).map((q) => `「${q.text}」`).join('')}`)
  if (ctx.type === 'service' && ctx.guestId && m.guestTally[ctx.guestId]) {
    const t = m.guestTally[ctx.guestId]
    lines.push(`对眼前的客人：${t.name}是她接过 ${t.count} 次的客人，最好一次 ${t.bestSat} 分`)
  }
  let body = lines.join('\n' + indent)
  if (body.length > PROMPT_BLOCK_MAX) body = cut(body, PROMPT_BLOCK_MAX)
  return `${indent}【${g.name}的记忆】（自然地流露，每次最多提一件，不要复述清单）\n${indent}${body}`
}

// ─── AI 心里话（每人每天最多一次） ─────────────────────────────────────────────

/** 昨天有新事件、今天还没请求过 */
export function needsAiSummary(g: MonstGirl, day: number): boolean {
  const m = g.memory
  return !!m && m.aiDay !== day && m.events.some((e) => e.day === day - 1)
}

export function buildGirlSummaryPrompt(g: MonstGirl, player: Pick<Player, 'name'>, speech: string, fetish: string): string {
  const m = memOf(g)
  const recent = m.events.filter((e) => !isPrivate(e)).sort((a, b) => b.day - a.day).slice(0, 8).map((e) => `第${e.day}天：${e.text}`).join('\n')
  return `你在为一款魔物娘娼馆经营游戏整理角色的内心独白。请以魔物娘${g.name}（${g.race}，性格：${g.personality}${speech ? `；${speech}` : ''}）的第一人称，写一段她此刻对馆主${player.name}与这些经历的「心里话」。
${fetish ? `${fetish}\n` : ''}好感 ${g.affection}/100，服从 ${g.obedience}/100，淫乱 ${g.lewdness}/100
上一段心里话：${m.summary || '（还没有）'}
最近的经历：
${recent || '（无）'}
${m.quotes.length ? `馆主对她说过：${m.quotes.map((q) => `「${q.text}」`).join('')}\n` : ''}要求：60-100字；符合她的性格、自称与口癖；挑一两件最在意的事带出情绪，不要罗列；不要编造上面没有的事件。
只输出JSON：{"summary":"..."}
（极重要：JSON 的结构符号 : , " { } 必须使用半角，严禁全角；字符串内部可用中文标点）`
}

export function parseSummary(text: string): string | null {
  const mm = text.match(/\{[\s\S]*\}/)
  const o = mm ? parseLooseJson<{ summary?: unknown }>(mm[0]) : null
  const s = o && typeof o.summary === 'string' ? o.summary.replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim() : ''
  return s ? cut(s, SUMMARY_MAX) : null
}

export type SummaryCaller = (prompt: string) => Promise<string>

/**
 * 对需要的人逐个请求（每人一次），返回 girlId → 新心里话；失败/坏 JSON 的人不在结果里。
 * prompts 由调用方用 buildGirlSummaryPrompt 生成后传入，避免这里依赖提示词模块。
 */
export async function generateMemorySummaries(save: GameSave, prompts: Record<string, string>, call: SummaryCaller): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const g of save.girls) {
    if (!needsAiSummary(g, save.currentDay) || !prompts[g.id]) continue
    try { const s = parseSummary(await call(prompts[g.id])); if (s) out[g.id] = s } catch { /* 保留本地心里话 */ }
  }
  return out
}

/** 写回：请求过的人都记 aiDay（成功的换掉心里话）；只改当天仍需要的人 */
export function applyMemorySummaries(save: GameSave, day: number, attempted: string[], results: Record<string, string>): GameSave {
  if (save.currentDay !== day || !attempted.length) return save
  return {
    ...save,
    girls: save.girls.map((g) => {
      if (!attempted.includes(g.id) || !g.memory) return g
      const m = memOf(g)
      return withMem(g, { ...m, aiDay: day, ...(results[g.id] ? { summary: results[g.id], summaryDay: day } : {}) })
    }),
  }
}

// ─── 旧存档回填 ───────────────────────────────────────────────────────────────

export function backfillMemory(g: MonstGirl, regulars: Guest[], day: number): MonstGirl {
  if (g.memory) return g
  let n: MonstGirl = { ...g, memory: emptyMemory() }
  for (const r of regulars) {
    const mem = r.memories?.[g.name]
    if (!mem) continue
    n = addEvent(n, { day, kind: 'service', text: `接待过${r.name}（${mem.visitCount}次）：${mem.girlAboutGuest}`, w: 2, guestId: r.id })
    const m = memOf(n)
    n = withMem(n, { ...m, guestTally: { ...m.guestTally, [r.id]: { name: r.name, count: mem.visitCount, bestSat: r.satisfaction ?? 0 } } })
  }
  if (g.incident) n = addEvent(n, { day: g.incident.day, kind: 'incident', text: g.incident.text, w: 2 })
  const m = memOf(n)
  return m.events.length ? withMem(n, { ...m, summary: localSummary(n), summaryDay: day }) : n
}
