// 开局阵容（UX 1）：馆主自己选 1 人 + 从另外 3 位随机预设里再挑 1 人；金币保持 500
import type { GameSave, MonstGirl, Player } from './types'
import { GIRL_TEMPLATES, GIRL_TEMPLATE_IMAGES } from './game-data'
import { withInitialProficiency } from './proficiency'
import { getGuestCapacity } from './game-engine'
import { rollDailyGuests } from './guest-gen'

export const PARTNER_CHOICES = 3

export interface PartnerOption { idx: number; girl: MonstGirl }

/** 3 个随机预设（排除与第一人同名的），带立绘与初始熟练度 */
export function partnerOptions(firstName: string, rng: () => number = Math.random, n = PARTNER_CHOICES): PartnerOption[] {
  const pool = GIRL_TEMPLATES.map((t, idx) => ({ t, idx })).filter((x) => x.t.name !== firstName)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  return pool.slice(0, n).map(({ t, idx }) => ({
    idx,
    girl: withInitialProficiency({ ...(t as MonstGirl), id: `start-${idx}`, imageUrl: GIRL_TEMPLATE_IMAGES[idx] ?? undefined, stamina: 100 }),
  }))
}

/** 开局存档：两人都补初始熟练度；第二人换一个唯一 id */
export function buildStartingSave(player: Player, first: MonstGirl, partner: MonstGirl | null, newId: () => string): GameSave {
  const girls = [withInitialProficiency(first)]
  if (partner) girls.push(withInitialProficiency({ ...partner, id: newId() }))
  return {
    player: { ...player, level: 1, reputation: 0 },
    girls,
    currentDay: 1,
    phase: 'morning',
    actionsUsedToday: 0,
    dailyGuests: rollDailyGuests(getGuestCapacity(1), 0, [], { day: 1, girls }),
    regulars: [],
  }
}
