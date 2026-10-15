// 客人生成的三种「偏向」：早期保底（6b）、定向刷新（6c）、店铺主题（7）。
// 偏好全由本地决定；AI 只润色文案（见 ai-guests.ts），刷新出的客人保持本地文案。
import { freeLimits } from './cheat'
import { BODY_TRAIT_IDS, BODY_BIAS_WORDS, getBodyTrait, type BodyTraitId } from './body-traits'
import type { GameSave, Guest, MonstGirl, OutfitPref } from './types'
import { createRandomGuest, generateDailyGuests, getGuestCapacity } from './game-engine'
import { RACES } from './game-data'
import { OUTFIT_PREFS } from './catalog'
import { getMainService, traitMatched } from './resolve-service'
import { proficiencyFromLegacy } from './proficiency'
import { getTheme } from './store-theme'
import { getDifficulty } from './archetypes'

type Main = '口侍' | '胸侍' | '身侍'
export interface GuestBias {
  races: string[]
  traits: string[]
  services: Main[]
  kind?: 'M' | 'S'
  outfits: OutfitPref[]
  /** 偏好的体质（泌乳 / 淫纹…） */
  bodies?: BodyTraitId[]
}
export const EMPTY_BIAS: GuestBias = { races: [], traits: [], services: [], outfits: [] }
export const biasEmpty = (b: GuestBias) => !b.races.length && !b.traits.length && !b.services.length && !b.kind && !b.outfits.length && !b.bodies?.length

import { withDesire, pickR } from './guest-desire'
export { withDesire }

// ─── 6c 定向刷新：文字/标签解析 ───────────────────────────────────────────────
const TRAIT_WORDS: [RegExp, string][] = [[/巨乳|大胸|爆乳|丰满/, '巨乳'], [/贫乳|平胸|小胸|萝/, '贫乳'], [/丰臀|翘臀|大屁股|屁股/, '丰臀'], [/兽耳|兽娘|毛茸/, '兽耳']]
const SERVICE_WORDS: [RegExp, Main][] = [[/口侍|口交|深喉|舔/, '口侍'], [/胸侍|乳交|乳夹/, '胸侍'], [/身侍|内射|插入|本番|子宫/, '身侍']]
const KIND_WORDS: [RegExp, 'M' | 'S'][] = [[/(^|[^A-Za-z])M($|[^A-Za-z])|M系|M性|抖M|施虐|调教她|羞辱/, 'M'], [/(^|[^A-Za-z])S($|[^A-Za-z])|S系|S性|抖S|女王|被榨|痴女|被支配/, 'S']]
/** 「喜欢牛娘、巨乳、胸侍、M」→ 结构化偏向；labels 用来回显解析结果 */
export function parseGuestBias(text: string): GuestBias & { labels: string[] } {
  const t = text.trim()
  const races = RACES.map((r) => r.name).filter((n) => t.includes(n) && !(n === '精灵' && t.includes('黑暗精灵') && t.split('精灵').length === 2))
  const traits = [...new Set(TRAIT_WORDS.filter(([re]) => re.test(t)).map(([, v]) => v))]
  const services = [...new Set(SERVICE_WORDS.filter(([re]) => re.test(t)).map(([, v]) => v))]
  const kinds = [...new Set(KIND_WORDS.filter(([re]) => re.test(t)).map(([, v]) => v))]
  const kind = kinds.length === 1 ? kinds[0] : undefined
  const outfits = OUTFIT_PREFS.filter((o) => !o.includes('客人') && t.includes(o))
  const bodies = BODY_TRAIT_IDS.filter((id) => BODY_BIAS_WORDS[id].test(t))
  const labels = [...races, ...traits, ...services, ...(kind ? [kind === 'M' ? 'M（想施虐）' : 'S（想被榨）'] : []), ...outfits, ...bodies.map((id) => `体质·${getBodyTrait(id)!.name}`)]
  return { races, traits, services, kind, outfits, bodies, labels }
}
/** 每个指定的维度按 strength 概率改写（强偏向，不保证 100%） */
export const BIAS_STRENGTH = 0.85
export function biasGuest(g: Guest, b: GuestBias, rng: () => number, strength = BIAS_STRENGTH): Guest {
  let out = { ...g }
  const svc = b.services.length && rng() < strength ? pickR(b.services, rng) : null
  const kind = b.kind && rng() < strength ? b.kind : undefined
  if (svc || kind) out = withDesire(out, svc ?? (getMainService(out) as Main), kind, rng)
  if (b.races.length && rng() < strength) out.prefRace = pickR(b.races, rng)
  if (b.traits.length && rng() < strength) out.prefTrait = pickR(b.traits, rng)
  if (b.outfits.length && rng() < strength) out.prefOutfit = pickR(b.outfits, rng)
  if (b.bodies?.length && rng() < strength) out.prefBody = pickR(b.bodies, rng)
  return out
}

// ─── 6b 早期保底 ──────────────────────────────────────────────────────────────
export const EARLY_GUARANTEE_DAYS = 3
export const EARLY_GUARANTEE_COUNT = 1
const MAINS: Main[] = ['口侍', '胸侍', '身侍']
export function bestMain(g: MonstGirl): Main {
  const p = g.proficiency ?? proficiencyFromLegacy(g)
  return MAINS.reduce((a, b) => ((p[b] ?? 0) > (p[a] ?? 0) ? b : a), '身侍' as Main)
}
/** 「合适」：偏好她的种族或身材，且主类型是她最拿手的那项 */
export function guestFits(guest: Guest, g: MonstGirl): boolean {
  return (guest.prefRace === g.race || traitMatched(guest, g)) && getMainService(guest) === bestMain(g)
}
/** 第 1–3 天：保证至少 2 位新客人（不动回头客）适合馆里某位魔物娘；不够就改写不合适的新客人 */
export function ensureEarlyMatches(guests: Guest[], girls: MonstGirl[], day: number, rng: () => number = Math.random): Guest[] {
  if (day > EARLY_GUARANTEE_DAYS || !girls.length) return guests
  const fits = (gu: Guest) => girls.some((g) => guestFits(gu, g))
  let need = Math.min(EARLY_GUARANTEE_COUNT, guests.filter((g) => !(g.visits ?? 0)).length) - guests.filter(fits).length
  if (need <= 0) return guests
  let k = Math.floor(rng() * girls.length)
  return guests.map((gu) => {
    if (need <= 0 || (gu.visits ?? 0) || fits(gu)) return gu
    const g = girls[k++ % girls.length]
    need--
    return { ...withDesire(gu, bestMain(g), undefined, rng), prefRace: g.race }
  })
}

// ─── 一天的客人池（结束今天 / 开局 / 刷新共用） ──────────────────────────────
export interface PoolOpts {
  day: number
  girls: MonstGirl[]
  bias?: GuestBias
  theme?: string | null
  /** 难度：新客人额外挑剔度 */
  demand?: number
}
/** 新客人成形：主题加权 → 定向偏向 → 主题排除（主题店不会出现与主题冲突的客人，定向也绕不过） */
export function shapeGuest(g: Guest, opts: PoolOpts, rng: () => number): Guest {
  if ((g.visits ?? 0) > 0) return g
  const th = opts.theme ? getTheme(opts.theme) : undefined
  let out = g
  if (th) out = th.boost(out, rng)
  if (opts.bias && !biasEmpty(opts.bias)) out = biasGuest(out, opts.bias, rng)
  if (th) out = { ...th.exclude(out, rng), themeTag: th.id }
  if (opts.demand) out = { ...out, demand: (out.demand ?? 0) + opts.demand }
  return out
}
export function rollDailyGuests(count: number, reputation: number, regulars: Guest[], opts: PoolOpts, rng: () => number = Math.random): Guest[] {
  const base = generateDailyGuests(count, reputation, regulars).map((g) => shapeGuest(g, opts, rng))
  return ensureEarlyMatches(base, opts.girls, opts.day, rng)
}

// ─── 6c 换一批客人 ────────────────────────────────────────────────────────────
export const REFRESH_LIMIT = 2
export const REFRESH_COST = [30, 60]
export const TARGETED_REFRESH_COST = [50, 100]
export function refreshesUsed(save: GameSave): number {
  return save.guestRefresh?.day === save.currentDay ? save.guestRefresh.count : 0
}
export function refreshCost(save: GameSave, targeted: boolean): number | null {
  if (freeLimits(save)) return 0
  const n = refreshesUsed(save)
  if (n >= REFRESH_LIMIT) return null
  return (targeted ? TARGETED_REFRESH_COST : REFRESH_COST)[n]
}
/**
 * 换掉今天还没接待的新客人（回头客留下）；早期保底照算；刷新出的客人用本地文案，并记 aiGuestsDay = 今天，
 * 当天不会再为他们发一次 AI 润色。
 */
export function refreshGuests(save: GameSave, bias: GuestBias | null, rng: () => number = Math.random): { save: GameSave; cost: number } | { error: string } {
  const cost = refreshCost(save, !!bias && !biasEmpty(bias))
  if (cost === null) return { error: `今天已经换过 ${REFRESH_LIMIT} 次了` }
  if (save.player.gold < cost) return { error: `金币不足（需要 ${cost}G）` }
  const keep = (save.dailyGuests ?? []).filter((g) => (g.visits ?? 0) > 0)
  const n = (save.dailyGuests ?? []).length - keep.length
  if (n <= 0) return { error: '没有可以换的新客人' }
  const opts: PoolOpts = { day: save.currentDay, girls: save.girls, bias: bias ?? undefined, theme: save.player.storeTheme ?? null, demand: getDifficulty(save.player.difficulty).demand }
  const fresh = Array.from({ length: n }, () => shapeGuest(createRandomGuest(save.player.reputation ?? 0), opts, rng))
  const dailyGuests = ensureEarlyMatches([...keep, ...fresh], save.girls, save.currentDay, rng)
  return {
    cost,
    save: {
      ...save,
      player: { ...save.player, gold: save.player.gold - cost },
      dailyGuests,
      aiGuestsDay: save.currentDay,
      guestRefresh: { day: save.currentDay, count: refreshesUsed(save) + 1 },
    },
  }
}
/** 开局 / 结束今天用的新一天客人池 */
export function nextDayGuests(save: GameSave, day: number, girls: MonstGirl[] = save.girls, rng: () => number = Math.random): Guest[] {
  return rollDailyGuests(getGuestCapacity(save.player.level), save.player.reputation ?? 0, save.regulars ?? [], { day, girls, theme: save.player.storeTheme ?? null, demand: getDifficulty(save.player.difficulty).demand }, rng)
}
