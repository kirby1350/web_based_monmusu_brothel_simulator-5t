import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { giveGift, endDay, upgradeDorm, nightPlan, restSummary } from './hub-logic'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '猫娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 60, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 10, obedience: 10, lewdness: 10, skills: [], imageTags: '', stamina: 50, ...o,
})
const save = (o: Partial<GameSave> = {}): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 300, day: 1, guestPreference: '', marketPreference: '' },
  girls: [girl(), girl({ id: 'b', name: 'B' })], currentDay: 1, phase: 'morning', actionsUsedToday: 0, dailyGuests: [], ...o,
})

test('送礼扣钱、加好感，同一天第二次（任何人）被拒，次日可再送', () => {
  const r = giveGift(save(), 'a', 1)
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.save.player.gold, 220)
  assert.equal(r.save.girls[0].affection, 10 + 15 + 2) // 第一次送这档：她记得，再 +2
  const r2 = giveGift(r.save, 'b', 0)
  assert.equal(r2.ok, false)
  const next = endDay(r.save)
  assert.ok(giveGift(next, 'b', 0).ok)
})

test('金币不足不能送礼', () => {
  const s = save(); s.player.gold = 10
  assert.equal(giveGift(s, 'a', 0).ok, false)
})

test('结束今天的休养：没出场 +15 并解除疲惫，每剩 1 次行动全员 +15；挂机减半不吃加成', () => {
  // a 出场了、b 没出场；用了 1 次行动 → 剩 2 次，全员 +30
  const s = save({ actionsUsedToday: 1, appearedToday: ['a'], girls: [girl({ stamina: 10 }), girl({ id: 'b', name: 'B', stamina: 10, exhausted: true })] })
  const p = nightPlan(s)
  assert.deepEqual(p.map((x) => [x.dorm, x.idle, x.unused, x.after]), [[25, 0, 30, 65], [25, 15, 30, 80]])
  const n = endDay(s, () => 0.99)
  assert.equal(n.girls[0].stamina, 65)
  assert.equal(n.girls[1].stamina, 80)
  assert.equal(n.girls[1].exhausted, false)
  assert.ok(n.lastDaySummary!.rest!.includes('剩 2 次行动，全员 +30'))
  assert.ok(restSummary(s).includes('没出场的B再 +15'))
  // 用满 3 次、都出场：没有休养加成
  const busy = save({ actionsUsedToday: 3, appearedToday: ['a', 'b'] })
  assert.equal(restSummary(busy), '')
  assert.ok(nightPlan(busy).every((x) => x.idle === 0 && x.unused === 0))
  // 机械挂机：宿舍减半，不吃休养加成
  const m = save({ actionsUsedToday: 0, machineNightGirlId: 'b', player: { ...save().player, ownedScenes: ['machine'] }, girls: [girl({ stamina: 10 }), girl({ id: 'b', name: 'B', stamina: 10 })] })
  const mp = nightPlan(m)
  assert.equal(mp[1].machine, true); assert.equal(mp[1].after, 10 + 12)
  assert.equal(mp[0].after, 10 + 25 + 15 + 45)
})

test('结束今天：通铺 +25、行动归零、客人池刷新、出场清空', () => {
  const s = save({ actionsUsedToday: 3, appearedToday: ['a'] })
  const n = endDay(s)
  assert.equal(n.currentDay, 2)
  assert.equal(n.girls[0].stamina, 75)
  assert.equal(n.actionsUsedToday, 0)
  assert.deepEqual(n.appearedToday, [])
  assert.equal(n.dailyGuests!.length, 2)
})

test('宿舍等级回复：软床 40，浴场 55 解除疲惫，单间 70 + 指定 15', () => {
  const lv = (dormLevel: number, extra: Partial<GameSave> = {}) => {
    // 行动用满、都出场了：只看宿舍恢复（没有休养加成）
    const s = save({ actionsUsedToday: 3, appearedToday: ['a', 'b'], ...extra, girls: [girl({ stamina: 0, exhausted: true }), girl({ id: 'b', stamina: 0, exhausted: true })] })
    s.player.dormLevel = dormLevel
    return endDay(s).girls
  }
  assert.equal(lv(2)[0].stamina, 40); assert.equal(lv(2)[0].exhausted, true)
  assert.equal(lv(3)[0].stamina, 55); assert.equal(lv(3)[0].exhausted, false)
  const g4 = lv(4, { bestBedGirlId: 'b' })
  assert.equal(g4[0].stamina, 70); assert.equal(g4[1].stamina, 85)
})

test('宿舍升级 400/900/1600，与娼馆等级分开', () => {
  const s = save(); s.player.gold = 5000
  let r = upgradeDorm(s); assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.player.gold, 4600); assert.equal(r.save.player.dormLevel, 2); assert.equal(r.save.player.level, undefined)
  r = upgradeDorm(r.save); if (!r.ok) return assert.fail()
  r = upgradeDorm(r.save); if (!r.ok) return assert.fail()
  assert.equal(r.save.player.gold, 5000 - 400 - 900 - 1600)
  assert.equal(upgradeDorm(r.save).ok, false)
})

