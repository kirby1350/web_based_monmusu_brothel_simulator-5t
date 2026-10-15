import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { fxPlayer, fxGirl } from './prompt-fixtures'
import { migrateSave } from './migrate-save'
import {
  cheatOn, freeLimits, setCheat, addGold, addReputation, setGirlStats, unlockAll, addPresetGirl, restoreStamina,
  skipToDay, endDayNow, makeGuest, matchingGuestSpec, spawnGuest, setHeatValues, resetActions,
} from './cheat'
import { refreshCost, guestFits } from './guest-gen'
import { canGiveGiftToday } from './hub-logic'
import { shouldGenerateAiGuests } from './ai-guests'
import { shadowLevel, SCENE_IDS } from './scenes'
import { getInclination, OUTFITS } from './catalog'
import { getMainService } from './resolve-service'
import { initHeat } from './arousal'

const base = (): GameSave => migrateSave({ player: { ...fxPlayer, gold: 100, reputation: 5 }, girls: [fxGirl()], currentDay: 4, phase: 'morning', actionsUsedToday: 2, dailyGuests: [], regulars: [] } as GameSave)

test('作弊：默认关，开关记在存档里且迁移后保留', () => {
  const s = base()
  assert.equal(cheatOn(s), false)
  const on = setCheat(s, { enabled: true })
  assert.equal(cheatOn(on), true)
  assert.equal(cheatOn(migrateSave(JSON.parse(JSON.stringify(on)))), true)
  assert.equal(freeLimits(setCheat(s, { freeLimits: true })), false, '没开作弊时解除限制不生效')
})

test('作弊：金币 / 声望（声望夹在 0–100）', () => {
  const s = addReputation(addGold(base(), 1000), 200)
  assert.equal(s.player.gold, 1100)
  assert.equal(s.player.reputation, 100)
})

test('作弊：改写姑娘数值（夹紧）、熟练度决定 M-S、性癖觉醒、阴影档', () => {
  const s = setGirlStats(base(), 'qx', { affection: 150, obedience: 90, lewdness: -5, stamina: 0, sensitivities: { 乳房: 99 }, proficiency: { M性: 80, 口侍: 77 }, fetishes: ['dungeon'], shadows: { water: 2 } })
  const g = s.girls[0]
  assert.deepEqual([g.affection, g.obedience, g.lewdness, g.stamina], [100, 90, 0, 0])
  assert.equal(g.sensitivities?.乳房, 99)
  assert.equal(g.sensitivities?.耳朵, 80)
  assert.equal(g.proficiency?.口侍, 77)
  assert.equal(getInclination(g), 'M')
  assert.ok(g.awakened?.includes('dungeon'))
  assert.equal(shadowLevel(g, 'water'), 2)
})

test('作弊：一键全解锁', () => {
  const p = unlockAll(base()).player
  assert.deepEqual([p.dormLevel, p.serviceRoomLevel, p.trainingRoomLevel], [4, 4, 4])
  assert.ok(SCENE_IDS.every((id) => p.ownedScenes?.includes(id)))
  assert.ok(OUTFITS.filter((o) => o.id !== 'regular').every((o) => p.wardrobe?.includes(o.id)))
  assert.ok(p.wardrobe?.includes('black'))
})

test('作弊：加预设姑娘（补齐字段）；重名报错', () => {
  const r = addPresetGirl(base(), '爱宕', 'x1')
  assert.ok(!('error' in r))
  const g = (r as GameSave).girls.find((x) => x.id === 'x1')!
  assert.ok(g.proficiency && g.sensitivities && g.stamina === 100)
  assert.ok('error' in addPresetGirl(r as GameSave, '爱宕', 'x2'))
  assert.ok('error' in addPresetGirl(base(), '不存在', 'x3'))
})

test('作弊：体力回满、行动清零、跳天、立即结束今天', () => {
  const s = setGirlStats(base(), 'qx', { stamina: 5 })
  assert.equal(restoreStamina(s).girls[0].stamina, 100)
  assert.equal(resetActions(s).actionsUsedToday, 0)
  const j = skipToDay(s, 12)
  assert.equal(j.currentDay, 12)
  assert.ok((j.dailyGuests ?? []).length > 0)
  assert.equal(endDayNow(s).currentDay, 5)
})

test('作弊：按偏好造客人；为某位姑娘造合适的客人', () => {
  const s = base()
  const g = makeGuest(s, { race: '牛娘', trait: '巨乳', main: '胸侍', kind: 'M', guestClass: 'noble', personality: '腼腆内向', prefOutfit: '黑丝' }, () => 0.3)
  assert.equal(g.prefRace, '牛娘'); assert.equal(g.prefTrait, '巨乳'); assert.equal(getMainService(g), '胸侍')
  assert.equal(g.guestClass, 'noble'); assert.equal(g.demand, 8); assert.ok(g.race.startsWith('贵族·'))
  assert.equal(g.personality, '腼腆内向'); assert.equal(g.prefOutfit, '黑丝')
  const girl = s.girls[0]
  const m = makeGuest(s, matchingGuestSpec(girl))
  assert.ok(guestFits(m, girl))
  assert.equal(spawnGuest(s, m).dailyGuests?.[0].id, m.id)
})

test('作弊：解除每日限制——换客人免费、送礼不限、AI 润色不限当天一次', () => {
  const s = { ...base(), guestRefresh: { day: 4, count: 2 }, player: { ...base().player, giftGivenOnDay: 4 }, aiGuestsDay: 4,
    dailyGuests: [makeGuest(base(), {})].map((g) => ({ ...g, aiFlavored: false })) }
  assert.equal(refreshCost(s, false), null)
  assert.equal(canGiveGiftToday(s), false)
  assert.equal(shouldGenerateAiGuests(s), false)
  const f = setCheat(s, { enabled: true, freeLimits: true })
  assert.equal(refreshCost(f, true), 0)
  assert.equal(canGiveGiftToday(f), true)
  assert.equal(shouldGenerateAiGuests(f), true)
})

test('作弊：会话内设兴奋 / 快感', () => {
  const girl = fxGirl()
  const h = initHeat(makeGuest(base(), {}), [girl])
  const a = setHeatValues(setHeatValues(h, 'guest', { arousal: 95 }), girl.id, { pleasure: 140 })
  assert.equal(a.guest.arousal, 95)
  assert.equal(a.girls[girl.id].pleasure, 100)
})
