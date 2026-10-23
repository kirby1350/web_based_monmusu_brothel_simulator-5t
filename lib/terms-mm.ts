// 魔物娘娼馆里的称呼接线：堕落 = 服从和淫乱的均值；淫纹体质（药剂 / 天生 / 作弊）算道具，档位 +1，解药能清。
import type { MonstGirl } from './types'
import { hasBodyTrait } from './body-traits'
import { addOverrides, detectTermCommands, resolveTerms, termsLine, type ResolvedTerms, type TermSlot } from './terms'
import { mmProfile } from './terms-canon'

export function corruptionOf(g: Pick<MonstGirl, 'obedience' | 'lewdness' | 'terms'>): number {
  return Math.max(0, Math.min(100, Math.round(((g.obedience ?? 0) + (g.lewdness ?? 0)) / 2) + (g.terms?.corruptionBonus ?? 0)))
}

/** 说话档（从容…高潮）换成快感值，好和 DK 共用同一套档位 */
export const BAND_PLEASURE: Record<string, number> = { 从容: 0, 动摇: 45, 慌乱: 65, 临界: 85, 高潮: 99 }

export function mmTerms(g: MonstGirl, opts: { band?: string; day?: number } = {}): ResolvedTerms {
  return resolveTerms(mmProfile(g), g.terms, {
    corruption: corruptionOf(g), pleasure: BAND_PLEASURE[opts.band ?? '从容'] ?? 0, now: opts.day ?? 0,
    boost: hasBodyTrait(g, 'crest', opts.day),
  })
}

export function mmTermsLine(g: MonstGirl, opts: { band?: string; day?: number } = {}): string {
  return termsLine(g.name, mmTerms(g, opts)).replace('叫你', '叫馆主')
}

/** 玩家这句话里的改称呼命令落到谁身上：点了名的人；都没点名就落到主位 */
export function termCommandsFor(cast: MonstGirl[], input: string): { girlId: string; cmds: { slot: TermSlot; value: string }[] }[] {
  const out: { girlId: string; cmds: { slot: TermSlot; value: string }[] }[] = []
  for (const sentence of input.split(/[。！!？?\n；;]/)) {
    const cmds = detectTermCommands(sentence)
    if (!cmds.length) continue
    const named = cast.filter((g) => sentence.includes(g.name))
    for (const g of named.length ? named : cast.slice(0, 1)) {
      const cur = out.find((o) => o.girlId === g.id)
      if (cur) cur.cmds.push(...cmds); else out.push({ girlId: g.id, cmds: [...cmds] })
    }
  }
  return out
}

export function applyTermCommands(g: MonstGirl, cmds: { slot: TermSlot; value: string }[], source: 'command' | 'training'): MonstGirl {
  return cmds.length ? { ...g, terms: addOverrides(g.terms, cmds, source) } : g
}
