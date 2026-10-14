import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import { resolveService } from './resolve-service'
import { applyServiceToSave, previewService } from './settle-session'

const girl: MonstGirl = {
  id: 'a', name: 'A', race: '猫娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
}
const guest: Guest = { id: 'c1', name: '雷克', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0, budget: 100 }
const other: Guest = { ...guest, id: 'c2' }
const save: GameSave = {
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 100, day: 1, guestPreference: '', marketPreference: '' },
  girls: [girl], currentDay: 1, phase: 'morning', actionsUsedToday: 0, dailyGuests: [guest, other],
}

test('跳过结算写档：金币、体力 −40、行动 +1、客人离池、好感 +1、已出场', () => {
  const r = resolveService({ girl, guest, skip: true })
  const { save: s, info } = applyServiceToSave(save, 'a', guest, r, () => 0.99)
  assert.equal(s.player.gold, 100 + r.reward)
  assert.equal(s.girls[0].stamina, 60)
  assert.equal(info.staminaAfter, 60)
  assert.equal(s.girls[0].affection, 21)
  assert.equal(s.actionsUsedToday, 1)
  assert.deepEqual(s.dailyGuests!.map((g) => g.id), ['c2'])
  assert.deepEqual(s.appearedToday, ['a'])
  assert.equal(info.becameRegular, false)
})

test('体力不会掉到负数，归零时疲惫', () => {
  const r = resolveService({ girl: { ...girl, stamina: 10 }, guest, skip: true })
  const { save: s } = applyServiceToSave({ ...save, girls: [{ ...girl, stamina: 10 }] }, 'a', guest, r)
  assert.equal(s.girls[0].stamina, 0)
  assert.equal(s.girls[0].exhausted, true)
})

test('预览给出收入区间和体力', () => {
  const p = previewService({ girl, guest })
  assert.ok(p.rewardRange[0] <= p.skip.reward && p.skip.reward <= p.rewardRange[1])
  assert.deepEqual(p.liveStamina, [25, 55])
  assert.equal(p.skip.staminaCost, 40)
})
