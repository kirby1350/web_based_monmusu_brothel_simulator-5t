import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { giveGift, restGirl, endDay, upgradeDorm, pendingSkillPicks, pickSkill, selectableSkills } from './hub-logic'

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

test('休息：体力 +50 封顶 100，行动 +1，行动用尽不可休息', () => {
  const r = restGirl(save(), 'a')
  assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.girls[0].stamina, 100)
  assert.equal(r.save.actionsUsedToday, 1)
  assert.deepEqual(r.save.appearedToday, ['a'])
  assert.equal(restGirl(save({ actionsUsedToday: 3 }), 'a').ok, false)
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
    const s = save({ ...extra, girls: [girl({ stamina: 0, exhausted: true }), girl({ id: 'b', stamina: 0, exhausted: true })] })
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

test('技能选择：阈值弹出、最多 3 个、M/S 互斥', () => {
  let g = girl({ obedience: 30 })
  assert.equal(pendingSkillPicks(g), 1)
  g = pickSkill(g, 'M性')!
  assert.equal(g.inclination, 'M')
  assert.equal(pendingSkillPicks(g), 0)
  assert.equal(pickSkill(g, '口侍'), null)
  g = { ...g, lewdness: 40, affection: 50 }
  assert.equal(pendingSkillPicks(g), 2)
  assert.ok(!selectableSkills(g).includes('S性'))
  g = pickSkill(g, '口侍')!; g = pickSkill(g, '手技')!
  assert.equal(pendingSkillPicks({ ...g, obedience: 100, lewdness: 100, affection: 100 }), 0)
})
