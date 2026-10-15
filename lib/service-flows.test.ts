import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Player } from './types'
import { migrateFlows, resolveFlow, saveFlow, duplicateFlow, deleteFlow, setDefaultFlow, defaultFlowChoice, FLOW_GIRL, STD_FLOW_ID, MAX_FLOWS } from './service-flows'
import { migrateSave } from './migrate-save'
import { getStepActions } from './custom-props'
import { STEP_STANDARD_ACTION } from './live-steps'

const basePlayer: Player = { name: '馆主', traits: [], customTraits: '', fetishes: [], gold: 500, day: 1, guestPreference: '', marketPreference: '' }
const mkSave = (p: Partial<Player> = {}): GameSave => ({ player: { ...basePlayer, ...p }, girls: [], currentDay: 3 } as unknown as GameSave)
let n = 0
const newId = () => `f${++n}`

test('迁移：旧 stepActions → 「标准」模板并设为默认；幂等；文字不变', () => {
  const p = migrateFlows({ ...basePlayer, stepActions: ['', '馆主挑逗', '', '', ''] })
  assert.equal(p.stepActions, undefined)
  assert.equal(p.defaultFlowId, STD_FLOW_ID)
  assert.deepEqual(p.serviceFlows!.map((f) => f.name), ['标准'])
  assert.equal(p.serviceFlows![0].actions[1], '馆主挑逗')
  assert.deepEqual(migrateFlows(p), p)
  // 迁移前后实际做法一致
  assert.deepEqual(getStepActions(p), getStepActions({ stepActions: ['', '馆主挑逗', '', '', ''] }))
  // 整个存档迁移两次结果相同
  const once = migrateSave(mkSave({ stepActions: ['迎', '', '', '', ''] }))
  assert.deepEqual(migrateSave(once).player, once.player)
  assert.equal(once.player.serviceFlows![0].actions[0], '迎')
})

test('没有旧做法的存档：「标准」模板全空 = 默认文字', () => {
  const p = migrateFlows(basePlayer)
  assert.deepEqual(getStepActions(p), STEP_STANDARD_ACTION)
})

test('模板：新建 / 复制 / 设默认 / 删除；上限 5；至少留一个', () => {
  let s = migrateSave(mkSave())
  let r = saveFlow(s, { name: '温柔路线', actions: ['轻声迎接', '', '', '', ''] }, newId)
  assert.ok(r.ok); s = r.save
  r = duplicateFlow(s, s.player.serviceFlows![1].id, newId); assert.ok(r.ok); s = r.save
  assert.equal(s.player.serviceFlows![2].name, '温柔路线副本')
  r = setDefaultFlow(s, s.player.serviceFlows![1].id); assert.ok(r.ok); s = r.save
  assert.equal(getStepActions(s.player)[0], '轻声迎接')
  while (s.player.serviceFlows!.length < MAX_FLOWS) { const x = saveFlow(s, { name: 'x', actions: [] }, newId); assert.ok(x.ok); s = x.save }
  assert.ok(!saveFlow(s, { name: '多一个', actions: [] }, newId).ok)
  // 删掉默认 → 默认改为第一个
  const defId = s.player.defaultFlowId!
  r = deleteFlow(s, defId); assert.ok(r.ok); s = r.save
  assert.equal(s.player.defaultFlowId, s.player.serviceFlows![0].id)
  while (s.player.serviceFlows!.length > 1) { const x = deleteFlow(s, s.player.serviceFlows![0].id); assert.ok(x.ok); s = x.save }
  assert.ok(!deleteFlow(s, s.player.serviceFlows![0].id).ok)
  assert.ok(!saveFlow(s, { name: '  ', actions: [] }, newId).ok)
})

test('这一场的流程：默认取她的专属，否则全馆默认；指定模板时覆盖', () => {
  let s = migrateSave(mkSave({ stepActions: ['', '馆主挑逗', '', '', ''] }))
  const r = saveFlow(s, { name: '粗暴', actions: ['', '', '', '粗暴地来', ''], plays: [{ step: 3, playId: 'deepthroat' }] }, newId)
  assert.ok(r.ok); s = r.save
  const girl = { name: '千雪', stepActions: ['', '她的挑逗', '', '', ''] }
  assert.equal(defaultFlowChoice(s.player, girl), FLOW_GIRL)
  assert.equal(defaultFlowChoice(s.player, {}), STD_FLOW_ID)
  const mine = resolveFlow(s.player, girl)
  assert.equal(mine.actions[1], '她的挑逗')
  assert.deepEqual(mine.actions, getStepActions(s.player, girl))
  const rough = resolveFlow(s.player, girl, s.player.serviceFlows![1].id)
  assert.equal(rough.actions[3], '粗暴地来')
  assert.equal(rough.actions[1], STEP_STANDARD_ACTION[1])
  assert.deepEqual(rough.plays, [{ step: 3, playId: 'deepthroat' }])
  // 不存在的选择退回默认
  assert.equal(resolveFlow(s.player, girl, 'nope').choice, STD_FLOW_ID)
})
