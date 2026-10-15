import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MonstGirl, Player } from './types'
import { partnerOptions, buildStartingSave, PARTNER_CHOICES } from './starting-roster'
import { GIRL_TEMPLATES } from './game-data'
import { getGirlCapacity } from './game-engine'

const player: Player = { name: '馆主', traits: [], customTraits: '', fetishes: [], gold: 500, day: 1, guestPreference: '', marketPreference: '' }

test('开局第二人：3 个不重复、排除第一人、带立绘与熟练度', () => {
  let seed = 3
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let k = 0; k < 20; k++) {
    const first = GIRL_TEMPLATES[k % GIRL_TEMPLATES.length].name
    const opts = partnerOptions(first, rng)
    assert.equal(opts.length, PARTNER_CHOICES)
    assert.equal(new Set(opts.map((o) => o.girl.name)).size, PARTNER_CHOICES)
    assert.ok(opts.every((o) => o.girl.name !== first && o.girl.proficiency && o.girl.imageUrl))
  }
})

test('开局存档：2 人、金币 500、第二人新 id、都有熟练度；容量够', () => {
  const first = { ...(GIRL_TEMPLATES[0] as MonstGirl), id: 'me' }
  const [opt] = partnerOptions(first.name, () => 0.5)
  const s = buildStartingSave(player, first, opt.girl, () => 'p2')
  assert.equal(s.girls.length, 2)
  assert.equal(s.player.gold, 500)
  assert.deepEqual(s.girls.map((g) => g.id), ['me', 'p2'])
  assert.ok(s.girls.every((g) => g.proficiency))
  assert.ok(getGirlCapacity(1) >= 2)
  assert.equal(buildStartingSave(player, first, null, () => 'x').girls.length, 1)
})
