// 7 店铺主题：经营页选 1 个（设施升级后可再开一格，暂未做）。
// 主题只改客人的「成分」：与主题冲突的客人不会出现、对口的更常见；客流量不变。
// 主题客人由符合主题的姑娘接待：满意度 +3（resolve-service 里算）。
import { bodyTraitsOf, BODY_TRAIT_IDS } from './body-traits'
import type { GameSave, Guest, MonstGirl } from './types'
import { getInclination } from './catalog'
import { withDesire, pickR } from './guest-desire'

export const THEME_COOLDOWN_DAYS = 3
export const THEME_SAT_BONUS = 3
/** 对口加权的概率 */
export const THEME_BOOST = 0.5

const BEAST = ['猫娘', '犬娘', '狐娘', '兔娘', '牛娘', '狼娘']
const EXOTIC = ['拉米亚', '蜘蛛娘', '史莱姆', '哈比', '龙娘', '鬼娘', '魅魔', '妖精', '人鱼']
const HUMANLIKE = ['精灵', '黑暗精灵', '吸血鬼', '魔女']

export interface StoreTheme {
  id: string
  label: string
  desc: string
  /** 哪些姑娘算「符合主题」 */
  fits: (g: MonstGirl) => boolean
  /** 对口客人更常见 */
  boost: (g: Guest, rng: () => number) => Guest
  /** 冲突客人改掉（必定执行） */
  exclude: (g: Guest, rng: () => number) => Guest
}

const kindIs = (g: MonstGirl, k: 'M' | 'S') => { const i = getInclination(g); return i === k || i === '两面' }

export const STORE_THEMES: StoreTheme[] = [
  {
    id: '巨乳', label: '巨乳名店', desc: '不接待偏爱贫乳的客人；偏爱巨乳、想要乳交的客人更多。',
    fits: (g) => (g.bust ?? 0) >= 95,
    boost: (g, r) => r() < THEME_BOOST ? (r() < 0.5 ? { ...g, prefTrait: '巨乳' } : withDesire({ ...g, prefTrait: '巨乳' }, '胸侍', undefined, r)) : g,
    exclude: (g) => g.prefTrait === '贫乳' ? { ...g, prefTrait: '巨乳' } : g,
  },
  {
    id: '贫乳', label: '贫乳专门', desc: '不接待偏爱巨乳的客人，也没有点名乳交的；偏爱贫乳的客人更多。',
    fits: (g) => (g.bust ?? 0) > 0 && (g.bust ?? 0) <= 82,
    boost: (g, r) => r() < THEME_BOOST ? { ...g, prefTrait: '贫乳' } : g,
    exclude: (g, r) => {
      let out = g.prefTrait === '巨乳' ? { ...g, prefTrait: '贫乳' } : g
      if (out.desireService === '胸侍') out = withDesire(out, pickR(['口侍', '身侍'] as const as unknown as ('口侍' | '身侍')[], r), undefined, r)
      return out
    },
  },
  {
    id: 'M系', label: 'M 系调教馆', desc: '不接待想被榨的客人；想施虐、想支配的客人更多。',
    fits: (g) => kindIs(g, 'M'),
    boost: (g, r) => r() < THEME_BOOST && g.desireKind !== 'M' ? withDesire(g, null, 'M', r) : g,
    exclude: (g, r) => g.desireKind === 'S' ? withDesire(g, null, 'M', r) : g,
  },
  {
    id: 'S系', label: 'S 系女王馆', desc: '不接待想施虐的客人；想被榨、想被支配的客人更多。',
    fits: (g) => kindIs(g, 'S'),
    boost: (g, r) => r() < THEME_BOOST && g.desireKind !== 'S' ? withDesire(g, null, 'S', r) : g,
    exclude: (g, r) => g.desireKind === 'M' ? withDesire(g, null, 'S', r) : g,
  },
  {
    id: '异种', label: '异种乐园', desc: '不接待偏爱精灵/吸血鬼这类近人种族的客人；点名蛇、蛛、龙、史莱姆的更多。',
    fits: (g) => EXOTIC.includes(g.race),
    boost: (g, r) => r() < THEME_BOOST ? { ...g, prefRace: pickR(EXOTIC.slice(0, 6), r) } : g,
    exclude: (g, r) => g.prefRace && HUMANLIKE.includes(g.prefRace) ? { ...g, prefRace: pickR(EXOTIC.slice(0, 6), r) } : g,
  },
  {
    id: '兽耳', label: '兽耳茶屋', desc: '不接待点名异种的客人；偏爱兽耳、毛茸茸尾巴的客人更多。',
    fits: (g) => BEAST.includes(g.race),
    boost: (g, r) => r() < THEME_BOOST ? (r() < 0.5 ? { ...g, prefTrait: '兽耳' } : { ...g, prefRace: pickR(BEAST, r) }) : g,
    exclude: (g, r) => g.prefRace && EXOTIC.includes(g.prefRace) ? { ...g, prefRace: pickR(BEAST, r) } : g,
  },
  {
    id: '人妻感', label: '人妻沙龙', desc: '不接待想被嫌弃着榨干的客人；想被温柔包容、偏爱和服与丰满身材的客人更多。',
    fits: (g) => g.race === '牛娘' || /温柔|母性|包容|成熟|人妻|圣女|宠溺/.test(`${g.personality ?? ''}${g.personalityTags ?? ''}`),
    boost: (g, r) => r() < THEME_BOOST ? { ...withDesire(g, '胸侍', '中性', r), prefOutfit: r() < 0.5 ? '和服' : g.prefOutfit } : g,
    exclude: (g, r) => /嫌弃|榨干/.test(g.desires) ? withDesire(g, '胸侍', '中性', r) : g,
  },
  {
    id: '体质', label: '体质改造馆', desc: '偏爱特殊体质（泌乳、淫纹、发情…）的客人更多；体质对上客人口味时迎客另有加分。',
    fits: (g) => bodyTraitsOf(g).length > 0,
    boost: (g, r) => r() < THEME_BOOST ? { ...g, prefBody: pickR(BODY_TRAIT_IDS, r) } : g,
    exclude: (g) => g,
  },
]

export function getTheme(id: string | null | undefined): StoreTheme | undefined {
  return id ? STORE_THEMES.find((t) => t.id === id) : undefined
}
/** 主题槽：目前 1 个（以后设施升级可开第 2 个） */
export function themeSlots(_save: GameSave): number { return 1 }
/** 还要等几天才能换主题（0 = 现在就能换；没设过主题可以直接设） */
export function themeCooldownLeft(save: GameSave): number {
  const d = save.player.storeThemeDay
  if (d === undefined || !save.player.storeTheme) return 0
  return Math.max(0, d + THEME_COOLDOWN_DAYS - save.currentDay)
}
/** 设主题 / 取消主题：都受冷却限制；生效从下一批新客人起（今天已到的客人不变） */
export function setStoreTheme(save: GameSave, id: string | null): { save: GameSave } | { error: string } {
  if ((save.player.storeTheme ?? null) === id) return { error: '已经是这个主题了' }
  const left = themeCooldownLeft(save)
  if (left > 0) return { error: `还要等 ${left} 天才能再换主题` }
  if (id && !getTheme(id)) return { error: '没有这个主题' }
  return { save: { ...save, player: { ...save.player, storeTheme: id, storeThemeDay: save.currentDay } } }
}
/** 主题加成：主题客人 + 符合主题的姑娘 */
export function themeSatBonus(guest: Guest, girl: MonstGirl): number {
  const th = getTheme(guest.themeTag)
  return th && th.fits(girl) ? THEME_SAT_BONUS : 0
}
