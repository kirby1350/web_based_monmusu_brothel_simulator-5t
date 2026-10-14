import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import { serviceFailIncident, nightlyIncidents, canPunish, incidentPromptLine } from './incidents'
import { resolveTraining, resolveLiveTraining } from './resolve-training'
import { applyServiceToSave, applyTrainingToSave } from './settle-session'
import { resolveService } from './resolve-service'
import { endDay } from './hub-logic'
import { migrateSave } from './migrate-save'
import { INCIDENT_TEMPLATES } from './catalog'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 }, ...o,
})
const guest = (o: Partial<Guest> = {}): Guest => ({ id: 'c', name: '客C', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0, budget: 100, ...o })
const save = (girls: MonstGirl[]): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 1, guestPreference: '', marketPreference: '' },
  girls, currentDay: 3, phase: 'morning', actionsUsedToday: 0, dailyGuests: [],
})
const seq = (...v: number[]) => { let i = 0; return () => v[Math.min(i++, v.length - 1)] }
const inc = { kind: '闯祸' as const, text: '偷懒被抓到', day: 2 }

test('「不满」才可能生成接客失败；概率注入；不叠加', () => {
  assert.equal(serviceFailIncident(girl(), guest(), 'unsatisfied', 3, () => 0.49)?.kind, '接客失败')
  assert.match(serviceFailIncident(girl(), guest(), 'unsatisfied', 3, () => 0.1)!.text, /客C/)
  assert.equal(serviceFailIncident(girl(), guest(), 'unsatisfied', 3, () => 0.5), null)
  assert.equal(serviceFailIncident(girl(), guest(), 'satisfied', 3, () => 0), null)
  assert.equal(serviceFailIncident(girl({ incident: inc }), guest(), 'unsatisfied', 3, () => 0), null)
})

test('结算写入事件：不满 + 注入随机数', () => {
  const g = girl({ obedience: 0, lewdness: 0, sensitivities: { 耳朵: 0, 阴蒂: 0, 唇舌: 0, 乳房: 0, 小穴: 0 } })
  const r = resolveService({ girl: g, guest: guest(), skip: true })
  assert.equal(r.tier.key, 'unsatisfied')
  const { save: s, info } = applyServiceToSave(save([g]), 'a', guest(), r, seq(0.99, 0.1))
  assert.equal(s.girls[0].incident?.kind, '接客失败'); assert.equal(s.girls[0].incident?.day, 3)
  assert.equal(info.incident?.kind, '接客失败')
  const none = applyServiceToSave(save([g]), 'a', guest(), r, seq(0.99, 0.9))
  assert.equal(none.save.girls[0].incident ?? null, null)
})

test('闯祸按注入随机数触发；过夜未处理服从 −3、好感不变（新闯祸当晚不扣）', () => {
  const gs = [girl({ id: 'a', affection: 20, obedience: 40, incident: inc }), girl({ id: 'b', name: 'B', affection: 20, obedience: 40 })]
  const quiet = nightlyIncidents(gs, 4, () => 0.9)
  assert.equal(quiet[0].obedience, 37); assert.equal(quiet[0].affection, 20); assert.equal(quiet[1].obedience, 40); assert.equal(quiet[1].incident, undefined)
  const loud = nightlyIncidents(gs, 4, seq(0.1, 0, 0))
  assert.equal(loud[1].incident?.kind, '闯祸'); assert.equal(loud[1].obedience, 40)
  assert.ok(INCIDENT_TEMPLATES.includes(loud[1].incident!.text))
  assert.equal(loud[0].incident, inc)
  const d = endDay(save(gs), () => 0.9)
  assert.equal(d.girls[0].obedience, 37); assert.equal(d.girls[0].affection, 20); assert.equal(d.currentDay, 4)
})

test('没有事件且不是 M 性熟练：不能惩罚', () => {
  assert.equal(canPunish(girl()), false)
  assert.equal(canPunish(girl({ skillRanks: { M性: '初学' } })), false)
  assert.equal(canPunish(girl({ skillRanks: { M性: '熟练' } })), true)
  assert.equal(resolveTraining({ girl: girl(), direction: 'punish', skip: true }).ok, false)
})

test('惩罚数值：驯服基础 × 倍率 + 服从 +3、M +1（不乘），清除事件，体力 20', () => {
  const g = girl({ incident: inc })
  const tame = resolveTraining({ girl: g, direction: 'tame', skip: true, roomLevel: 4 })
  const p = resolveTraining({ girl: g, direction: 'punish', skip: true, roomLevel: 4 })
  assert.ok(p.ok)
  assert.equal(p.delta.obedience, tame.delta.obedience + 3)
  assert.equal(p.delta.m, tame.delta.m + 1)
  assert.equal(p.delta.affection, tame.delta.affection)
  assert.equal(p.girl.incident, null)
  assert.equal(p.staminaCost, 20)
  const s = applyTrainingToSave(save([g]), p)
  assert.equal(s.girls[0].incident, null)
  const live = resolveLiveTraining({ girl: g, direction: 'punish', roomLevel: 1 }, 4, 10)
  assert.equal(live.girl.incident, null)
})

test('M 性熟练、没有事件：不加服从，好感 +3', () => {
  const g = girl({ skillRanks: { M性: '熟练' } })
  const tame = resolveTraining({ girl: g, direction: 'tame', skip: true })
  const p = resolveTraining({ girl: g, direction: 'punish', skip: true })
  assert.equal(p.delta.obedience, tame.delta.obedience)
  assert.equal(p.delta.affection, tame.delta.affection + 3)
})

test('亲自上场提示词含事件文字；迁移后照常结算', () => {
  assert.match(incidentPromptLine(girl({ name: '千雪', incident: inc })), /千雪偷懒被抓到/)
  const m = migrateSave(save([girl()]))
  assert.equal(m.girls[0].incident, null)
  assert.deepEqual(migrateSave(m), m)
  assert.ok(resolveTraining({ girl: m.girls[0], direction: 'tame', skip: true }).ok)
})
