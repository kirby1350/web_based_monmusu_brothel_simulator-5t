// AI 润色当天客人：身份/预算/挑剔度/需求判定全由游戏决定，AI 只改文案与已存在的偏好取值。
// 失败、超时、坏 JSON 一律静默保留随机客人。
import { freeLimits } from './cheat'
import type { GameSave, Guest, OutfitPref } from './types'
import { GUEST_CLASSES, GUEST_PREF_TRAIT_TAGS } from './game-engine'
import { OUTFIT_PREFS } from './catalog'
import { VALID_RACES } from './prompt-context'
import { buildGuestGenerationPrompt } from './prompt-builder'
import { parseLooseJson } from './utils'

export const AI_GUEST_TIMEOUT_MS = 20_000

const CLASS_STYLE: Record<string, string> = {
  commoner: '普通镇民/工匠/农夫，朴实直接，有点紧张或好色',
  merchant: '精明的商人，讲究排场、爱讨价还价，说话圆滑',
  adventurer: '粗犷的冒险者，带着伤疤与酒气，直来直去、手脚粗重',
  noble: '高傲的贵族，居高临下、极度挑剔，把魔物娘当玩物品评',
  captain: '冒险者队长，威严强势、习惯发号施令，要求干脆利落',
}

/** 只润色新客人：回头客（有来访/记忆）和已润色过的不动 */
export function isAiEligible(g: Guest): boolean {
  return !g.aiFlavored && !(g.visits ?? 0) && !(g.memories && Object.keys(g.memories).length)
}

export function shouldGenerateAiGuests(save: GameSave): boolean {
  return (freeLimits(save) || save.aiGuestsDay !== save.currentDay) && (save.dailyGuests ?? []).some(isAiEligible)
}

export function aiGuestPrompt(guest: Guest, others: string[], preference = ''): string {
  const cls = GUEST_CLASSES[guest.guestClass ?? 'commoner']
  return buildGuestGenerationPrompt(preference, others, cls.label, {
    style: CLASS_STYLE[cls.key], theme: guest.desires,
    prefs: { race: !!guest.prefRace, trait: !!guest.prefTrait, outfit: !!guest.prefOutfit },
    traitTags: GUEST_PREF_TRAIT_TAGS, outfitPrefs: OUTFIT_PREFS,
  })
}

const clean = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/[<>{}\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : undefined
}

/**
 * 校验 AI 字段并合进随机客人：缺失/非法的字段保留原值。
 * 锁死：id、budget、guestClass、demand、desires/desireKind/desireService（判定用）、visits、satisfaction、memories、各偏好「有没有」。
 */
export function sanitizeAiGuest(raw: unknown, base: Guest): Guest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const o = raw as Record<string, unknown>
  const cls = base.guestClass && base.guestClass !== 'commoner' ? GUEST_CLASSES[base.guestClass].label : ''
  const name = clean(o.name, 8)
  const race = clean(o.race, 12)?.replace(/^.*·/, '')
  const traits = Array.isArray(o.traits) ? o.traits.map((t) => clean(t, 12)).filter((t): t is string => !!t).slice(0, 3) : []
  const prefRace = typeof o.prefRace === 'string' && VALID_RACES.includes(o.prefRace.trim()) ? o.prefRace.trim() : undefined
  const prefTrait = typeof o.prefTrait === 'string' && GUEST_PREF_TRAIT_TAGS.includes(o.prefTrait.trim()) ? o.prefTrait.trim() : undefined
  const prefOutfit = typeof o.prefOutfit === 'string' && (OUTFIT_PREFS as string[]).includes(o.prefOutfit.trim()) ? (o.prefOutfit.trim() as OutfitPref) : undefined
  const imageTags = clean(o.imageTags, 400)
  return {
    ...base,
    name: name ?? base.name,
    race: race ? (cls ? `${cls}·${race}` : race) : base.race,
    personality: clean(o.personality, 60) ?? base.personality,
    traits: traits.length ? traits : base.traits,
    desireDetail: clean(o.desires, 80) ?? base.desireDetail,
    prefRace: base.prefRace ? (prefRace ?? base.prefRace) : base.prefRace,
    prefTrait: base.prefTrait ? (prefTrait ?? base.prefTrait) : base.prefTrait,
    prefOutfit: base.prefOutfit ? (prefOutfit ?? base.prefOutfit) : base.prefOutfit,
    imageTags: imageTags && /\b1(man|boy)\b|male/i.test(imageTags) ? imageTags : base.imageTags,
    aiFlavored: true,
  }
}

/** 解析模型回复（可能夹杂说明文字）；解析失败返回 null */
export function parseAiGuest(text: string, base: Guest): Guest | null {
  const m = text.match(/\{[\s\S]*\}/)
  const obj = m ? parseLooseJson<Record<string, unknown>>(m[0]) : null
  return obj ? sanitizeAiGuest(obj, base) : null
}

/** 把结果合进「最新」存档：只换还在今天客人池里的同 id 客人，并记下已尝试 */
export function applyAiGuests(save: GameSave, day: number, upgraded: Guest[]): GameSave {
  if (save.currentDay !== day) return save
  const byId = new Map(upgraded.map((g) => [g.id, g]))
  return {
    ...save,
    aiGuestsDay: day,
    dailyGuests: (save.dailyGuests ?? []).map((g) => (byId.has(g.id) && isAiEligible(g) ? byId.get(g.id)! : g)),
  }
}

export type ChatFetcher = (prompt: string, signal: AbortSignal) => Promise<string>

/** 并发请求每位新客人；任何失败/超时只影响那一位（保留随机值）。从不抛错 */
export async function generateAiGuests(save: GameSave, fetcher: ChatFetcher, timeoutMs = AI_GUEST_TIMEOUT_MS): Promise<Guest[]> {
  const guests = (save.dailyGuests ?? []).filter(isAiEligible)
  const names = (save.dailyGuests ?? []).map((g) => g.name)
  const results = await Promise.all(guests.map(async (g) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const text = await fetcher(aiGuestPrompt(g, names.filter((n) => n !== g.name)), ctrl.signal)
      return parseAiGuest(text, g)
    } catch { return null } finally { clearTimeout(timer) }
  }))
  return results.filter((g): g is Guest => !!g)
}
