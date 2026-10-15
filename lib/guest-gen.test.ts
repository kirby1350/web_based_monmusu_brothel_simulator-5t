import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGuestBias, biasGuest, ensureEarlyMatches, guestFits, bestMain, refreshGuests, refreshCost, nextDayGuests, EARLY_GUARANTEE_DAYS, REFRESH_COST, TARGETED_REFRESH_COST } from './guest-gen'
import { createRandomGuest } from './game-engine'
import { getMainService } from './resolve-service'
import { guestPrefChecks } from './guest-prefs'
import { CASES } from '../scripts/live-sat-table'
import type { GameSave } from './types'

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

test('定向解析：喜欢牛娘、巨乳、胸侍、M', () => {
  const b = parseGuestBias('喜欢牛娘、巨乳、胸侍、M')
  assert.deepEqual(b.races, ['牛娘']); assert.deepEqual(b.traits, ['巨乳']); assert.deepEqual(b.services, ['胸侍']); assert.equal(b.kind, 'M')
  assert.equal(parseGuestBias('想要大胸的乳交，S').kind, 'S')
  assert.deepEqual(parseGuestBias('大胸 乳交').traits, ['巨乳'])
  assert.equal(parseGuestBias('随便').labels.length, 0)
  assert.deepEqual(parseGuestBias('黑暗精灵').races, ['黑暗精灵'])
})

test('定向偏向：强偏向（约 85%/项），不是 100%', () => {
  const rng = mulberry32(5)
  const b = parseGuestBias('牛娘 巨乳 身侍')
  let race = 0, trait = 0, svc = 0
  const N = 400
  for (let i = 0; i < N; i++) {
    const g = biasGuest(createRandomGuest(0), b, rng)
    if (g.prefRace === '牛娘') race++
    if (g.prefTrait === '巨乳') trait++
    if (getMainService(g) === '身侍') svc++
  }
  for (const n of [race, trait, svc]) assert.ok(n / N > 0.8 && n / N < 1, String(n / N))
})

test('早期保底：第 1–3 天至少 1 位新客人适合馆里某位姑娘；回头客不动；第 4 天起不管', () => {
  const girls = [CASES[1].girl, { ...CASES[0].girl, id: 'x2' }]
  const rng = mulberry32(9)
  for (let i = 0; i < 50; i++) {
    const raw = Array.from({ length: 3 }, () => ({ ...createRandomGuest(0), prefRace: '史莱姆', prefTrait: '丰臀' }))
    const regular = { ...createRandomGuest(0), visits: 2, prefRace: '史莱姆' }
    const out = ensureEarlyMatches([regular, ...raw], girls, 1, rng)
    assert.ok(out.some((g) => girls.some((x) => guestFits(g, x))))
    assert.deepEqual(out[0], regular)
    assert.deepEqual(ensureEarlyMatches(raw, girls, EARLY_GUARANTEE_DAYS + 1, rng), raw)
  }
  assert.ok(['口侍', '胸侍', '身侍'].includes(bestMain(girls[0])))
})

function saveOf(gold = 500): GameSave {
  const girls = [CASES[1].girl]
  return { player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold, day: 1, guestPreference: '', marketPreference: '', level: 1, reputation: 0 },
    girls, currentDay: 2, phase: 'morning', actionsUsedToday: 0, regulars: [], aiGuestsDay: undefined,
    dailyGuests: [{ ...createRandomGuest(0), visits: 1, name: '老熟客' }, createRandomGuest(0), createRandomGuest(0)] } as unknown as GameSave
}

test('换一批客人：30→60G，定向 50→100G，共用每天 2 次；回头客留下；当天不再 AI 润色', () => {
  let s = saveOf()
  assert.equal(refreshCost(s, false), REFRESH_COST[0]); assert.equal(refreshCost(s, true), TARGETED_REFRESH_COST[0])
  const r1 = refreshGuests(s, null, mulberry32(1))
  assert.ok(!('error' in r1)); s = (r1 as { save: GameSave }).save
  assert.equal(s.player.gold, 470)
  assert.equal(s.dailyGuests!.length, 3); assert.equal(s.dailyGuests![0].name, '老熟客')
  assert.equal(s.aiGuestsDay, s.currentDay)
  assert.equal(refreshCost(s, true), TARGETED_REFRESH_COST[1])
  const r2 = refreshGuests(s, parseGuestBias('胸侍'), mulberry32(2))
  assert.ok(!('error' in r2)); s = (r2 as { save: GameSave }).save
  assert.equal(s.player.gold, 370)
  assert.equal(refreshCost(s, false), null)
  assert.ok('error' in refreshGuests(s, null))
  // 第二天重置
  assert.equal(refreshCost({ ...s, currentDay: 3 }, false), REFRESH_COST[0])
  assert.ok('error' in refreshGuests(saveOf(10), null))
})

test('新一天客人池走同一条路（含保底）', () => {
  const s = saveOf()
  const gs = nextDayGuests({ ...s, currentDay: 1 }, 2, s.girls, mulberry32(3))
  assert.ok(gs.some((g) => guestFits(g, s.girls[0])))
})

test('客人喜好 ✓/✗：种族/身材/主类型/服装/M·S/挑剔', () => {
  const c = CASES[1]
  const g = { ...c.guest, prefRace: c.girl.race, prefTrait: '贫乳', prefOutfit: '制服' as const, desireKind: 'M' as const, demand: 4, guestClass: 'merchant' as const }
  const checks = Object.fromEntries(guestPrefChecks(g, [c.girl], { outfit: 'maid' }).map((x) => [x.key, x]))
  assert.equal(checks.race.ok, true)
  assert.equal(checks.trait.ok, false)
  assert.equal(checks.outfit.ok, true)
  assert.equal(guestPrefChecks(g, [c.girl], { outfit: 'regular' }).find((x) => x.key === 'outfit')!.ok, false)
  assert.ok(checks.demand.label.includes('商人'))
  assert.ok('kind' in checks)
})
