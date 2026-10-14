import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MonstGirl } from './types'
import { mischiefPool, nightlyIncidents } from './incidents'
import { INCIDENT_TEMPLATES, RACE_INCIDENT_TEMPLATES, AFFECTION_INCIDENT_TEMPLATES } from './catalog'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '精灵', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 60, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 50, obedience: 40, lewdness: 10, skills: [], imageTags: '', ...o,
})

test('新增 8–12 条种族/好感事件，且互不重复', () => {
  const extra = [...Object.values(RACE_INCIDENT_TEMPLATES).flat(), ...AFFECTION_INCIDENT_TEMPLATES.low, ...AFFECTION_INCIDENT_TEMPLATES.high]
  assert.ok(extra.length >= 8 && extra.length <= 12, `got ${extra.length}`)
  assert.equal(new Set([...extra, ...INCIDENT_TEMPLATES]).size, extra.length + INCIDENT_TEMPLATES.length)
})

test('中等好感、无专属种族：只有通用事件', () => {
  assert.deepEqual(mischiefPool(girl()), INCIDENT_TEMPLATES)
})

test('种族专属事件只给对应种族', () => {
  const dragon = mischiefPool(girl({ race: '龙娘' }))
  assert.ok(dragon.includes(RACE_INCIDENT_TEMPLATES['龙娘'][0]))
  assert.ok(!dragon.includes(RACE_INCIDENT_TEMPLATES['犬娘'][0]))
})

test('低好感 / 高好感分别加入对应事件，边界 30 / 70', () => {
  const low = mischiefPool(girl({ affection: 29 }))
  assert.ok(AFFECTION_INCIDENT_TEMPLATES.low.every((t) => low.includes(t)))
  assert.ok(!low.includes(AFFECTION_INCIDENT_TEMPLATES.high[0]))
  assert.ok(!mischiefPool(girl({ affection: 30 })).includes(AFFECTION_INCIDENT_TEMPLATES.low[0]))
  const high = mischiefPool(girl({ affection: 70 }))
  assert.ok(AFFECTION_INCIDENT_TEMPLATES.high.every((t) => high.includes(t)))
})

test('夜间闯祸从该魔物娘自己的池子里抽（取最后一条 = 种族/好感事件）', () => {
  const g = girl({ race: '吸血鬼', affection: 90 })
  const out = nightlyIncidents([g], 3, (() => { const v = [0, 0, 0.999]; let i = 0; return () => v[i++] })())
  const pool = mischiefPool(g)
  assert.equal(out[0].incident?.text, pool[pool.length - 1])
  assert.ok(AFFECTION_INCIDENT_TEMPLATES.high.includes(out[0].incident!.text))
})

test('单人新档：endDay 掷中 15% 时她会闯祸（hub 角标/角色卡读 girl.incident）', async () => {
  const { endDay } = await import('./hub-logic')
  const { migrateSave } = await import('./migrate-save')
  const s = migrateSave({ player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 500, day: 1, guestPreference: '', marketPreference: '' },
    girls: [girl({ name: '千雪', affection: 10 })], currentDay: 1, phase: 'morning' })
  const hit = endDay(s, () => 0.1)
  assert.equal(hit.girls[0].incident?.kind, '闯祸')
  assert.ok(mischiefPool(hit.girls[0]).includes(hit.girls[0].incident!.text))
  assert.equal(endDay(s, () => 0.2).girls[0].incident ?? null, null)
  // 已挂着接客失败：不叠加闯祸，只扣服从
  const tagged = { ...s, girls: [{ ...s.girls[0], incident: { kind: '接客失败' as const, text: 'x', day: 1 } }] }
  const n = endDay(tagged, () => 0)
  assert.equal(n.girls[0].incident?.kind, '接客失败'); assert.equal(n.girls[0].obedience, 37)
})
