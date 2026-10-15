// 6a 客人喜好一览：每项喜好 + 是否对得上（✓/✗；无从判断时 undefined）
import type { Guest, MonstGirl, OutfitId } from './types'
import { OUTFITS, STOCKINGS, getSkillRank, getInclination } from './catalog'
import { getAvailablePlays, getMainService, scorePlay, traitMatched } from './resolve-service'
import { GUEST_CLASSES } from './game-engine'
import { getTheme } from './store-theme'

export interface PrefCheck { key: string; label: string; ok?: boolean }
const KIND_TEXT = { M: 'M（想施虐）', S: 'S（想被榨）' } as const

/**
 * girls：对照的魔物娘（准备页/场内 = 已选的人；大厅 = 全馆，任一人对得上即 ✓）。
 * outfit：已选服装（准备页/场内）；没有时看衣橱 wardrobe 里有没有对口的。
 */
export function guestPrefChecks(guest: Guest, girls: MonstGirl[], opts: { outfit?: OutfitId; stockings?: string; wardrobe?: string[] } = {}): PrefCheck[] {
  const any = (f: (g: MonstGirl) => boolean) => (girls.length ? girls.some(f) : undefined)
  const main = getMainService(guest)
  const out: PrefCheck[] = []
  if (guest.prefRace) out.push({ key: 'race', label: `种族 ${guest.prefRace}`, ok: any((g) => g.race === guest.prefRace) })
  if (guest.prefTrait) out.push({ key: 'trait', label: `身材 ${guest.prefTrait}`, ok: any((g) => traitMatched(guest, g)) })
  out.push({ key: 'main', label: `主类型 ${main}`, ok: any((g) => !!getSkillRank(g, main)) })
  const plays = girls.length ? [...new Set(girls.flatMap((g) => getAvailablePlays(g, guest).filter((p) => { const r = scorePlay(g, guest, p); return r.matched && r.score > 0 }).map((p) => p.name)))] : []
  out.push({ key: 'plays', label: plays.length ? `对口 play ${plays.slice(0, 2).join('、')}${plays.length > 2 ? '…' : ''}` : '对口 play', ok: girls.length ? plays.length > 0 : undefined })
  if (guest.prefOutfit) {
    const owned = (id: string) => id === opts.outfit || id === opts.stockings
    const ok = opts.outfit
      ? [...OUTFITS, ...STOCKINGS].some((o) => o.pref === guest.prefOutfit && owned(o.id))
      : opts.wardrobe ? [...OUTFITS, ...STOCKINGS].some((o) => o.pref === guest.prefOutfit && opts.wardrobe!.includes(o.id)) : undefined
    out.push({ key: 'outfit', label: `服装 ${guest.prefOutfit}`, ok })
  }
  if (guest.desireKind === 'M' || guest.desireKind === 'S') {
    const k = guest.desireKind
    out.push({ key: 'kind', label: KIND_TEXT[k], ok: any((g) => { const inc = getInclination(g); return inc === k || inc === '两面' }) })
  }
  const th = getTheme(guest.themeTag)
  if (th) out.push({ key: 'theme', label: `主题客 ${th.id}`, ok: any((g) => th.fits(g)) })
  const demand = guest.demand ?? 0
  out.push({ key: 'demand', label: demand ? `挑剔 −${demand}（${GUEST_CLASSES[guest.guestClass ?? 'commoner'].label}）` : '不挑剔' })
  return out
}
