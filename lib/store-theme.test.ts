import test from 'node:test'
import assert from 'node:assert/strict'
import { STORE_THEMES, getTheme, setStoreTheme, themeCooldownLeft, themeSatBonus, THEME_COOLDOWN_DAYS, THEME_SAT_BONUS } from './store-theme'
import { rollDailyGuests, refreshGuests, parseGuestBias, shapeGuest } from './guest-gen'
import { createRandomGuest } from './game-engine'
import { resolveService } from './resolve-service'
import { CASES } from '../scripts/live-sat-table'
import type { GameSave } from './types'

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

test('主题：冲突客人不出现、对口更多、客流不变', () => {
  const rng = mulberry32(11)
  const girls = [CASES[1].girl]
  let big = 0, bigBase = 0, n = 0
  for (let i = 0; i < 100; i++) {
    const day = 10
    const themed = rollDailyGuests(4, 0, [], { day, girls, theme: '巨乳' }, rng)
    const plain = rollDailyGuests(4, 0, [], { day, girls }, rng)
    assert.equal(themed.length, 4)
    assert.ok(themed.every((g) => g.prefTrait !== '贫乳' && g.themeTag === '巨乳'))
    big += themed.filter((g) => g.prefTrait === '巨乳').length; bigBase += plain.filter((g) => g.prefTrait === '巨乳').length; n += 4
  }
  assert.ok(big / n > bigBase / n + 0.25, `${big / n} vs ${bigBase / n}`)
  for (const th of STORE_THEMES) {
    for (let i = 0; i < 60; i++) {
      const g = shapeGuest(createRandomGuest(0), { day: 9, girls, theme: th.id }, rng)
      if (th.id === 'M系') assert.notEqual(g.desireKind, 'S')
      if (th.id === 'S系') assert.notEqual(g.desireKind, 'M')
      if (th.id === '贫乳') assert.ok(g.prefTrait !== '巨乳' && g.desireService !== '胸侍')
      if (th.id === '人妻感') assert.ok(!/嫌弃|榨干/.test(g.desires))
    }
  }
})

test('主题挡得住定向刷新里的冲突偏好；回头客不受主题影响', () => {
  const rng = mulberry32(3)
  for (let i = 0; i < 50; i++) {
    const g = shapeGuest(createRandomGuest(0), { day: 9, girls: [], theme: '巨乳', bias: parseGuestBias('贫乳') }, rng)
    assert.notEqual(g.prefTrait, '贫乳')
  }
  const reg = { ...createRandomGuest(0), visits: 3, prefTrait: '贫乳' }
  assert.deepEqual(shapeGuest(reg, { day: 9, girls: [], theme: '巨乳' }, rng), reg)
  const save = { player: { gold: 500, reputation: 0, storeTheme: 'S系', storeThemeDay: 1 }, girls: [CASES[1].girl], currentDay: 5, regulars: [],
    dailyGuests: [createRandomGuest(0), createRandomGuest(0)] } as unknown as GameSave
  const r = refreshGuests(save, parseGuestBias('M'), rng)
  assert.ok(!('error' in r))
  assert.ok((r as { save: GameSave }).save.dailyGuests!.every((g) => g.desireKind !== 'M'))
})

test('主题冷却 3 天；首次设置不等；取消也算换', () => {
  let s = { player: { gold: 0 }, currentDay: 4, girls: [] } as unknown as GameSave
  assert.equal(themeCooldownLeft(s), 0)
  s = (setStoreTheme(s, '巨乳') as { save: GameSave }).save
  assert.equal(s.player.storeTheme, '巨乳')
  assert.equal(themeCooldownLeft(s), THEME_COOLDOWN_DAYS)
  assert.ok('error' in setStoreTheme(s, 'M系'))
  assert.ok('error' in setStoreTheme({ ...s, currentDay: 6 }, null))
  const later = setStoreTheme({ ...s, currentDay: 4 + THEME_COOLDOWN_DAYS }, 'M系')
  assert.ok(!('error' in later))
})

test('主题加成：主题客人 + 符合主题的姑娘 +3（跳过和亲自上场都算）', () => {
  const c = CASES[1]
  const girl = { ...c.girl, bust: 105 }
  const g = { ...c.guest, themeTag: '巨乳' }
  assert.equal(themeSatBonus(g, girl), THEME_SAT_BONUS)
  assert.equal(themeSatBonus(g, { ...girl, bust: 80 }), 0)
  assert.equal(themeSatBonus(c.guest, girl), 0)
  const a = resolveService({ girl, guest: g, outfit: c.outfit, stockings: c.stockings, roomLevel: 1, skip: false })
  const b = resolveService({ girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, roomLevel: 1, skip: false })
  assert.equal(a.satisfaction - b.satisfaction, THEME_SAT_BONUS)
  assert.ok(a.raceNotes.some((x) => x.includes('主题店')))
  assert.ok(getTheme('异种')!.fits({ ...girl, race: '拉米亚' }))
})
