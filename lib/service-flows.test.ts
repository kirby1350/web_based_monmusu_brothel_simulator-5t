import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Player } from './types'
import { migrateFlows, resolveFlow, saveFlow, duplicateFlow, deleteFlow, setDefaultFlow, defaultFlowChoice, getFlows, flowOptions, raceFlow, PRESET_FLOWS, FLOW_GIRL, STD_FLOW_ID, MAX_FLOWS } from './service-flows'
import { ALL_PLAYS, RACE_PLAYS, STEP_ACTION_MAX } from './catalog'
import { RACES } from './game-data'
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

test('这一场：play 挂到步骤只改做法文字；偏好 play 只取可选的、受槽数限制', async () => {
  const { stepActionsWithPlays, preferredPlays } = await import('./service-flows')
  const acts = ['a', 'b', 'c', 'd', 'e']
  const out = stepActionsWithPlays(acts, { deepthroat: 3, paizuri: 3, lewd_dance: 0 }, (id) => ({ deepthroat: '深喉', paizuri: '乳交', lewd_dance: '色气舞蹈' } as Record<string, string>)[id])
  assert.deepEqual(out, ['a（穿插：色气舞蹈）', 'b', 'c', 'd（穿插：深喉、乳交）', 'e'])
  assert.deepEqual(stepActionsWithPlays(acts, undefined, () => 'x'), acts)
  const pp = preferredPlays([{ step: 3, playId: 'deepthroat' }, { step: 1, playId: 'nope' }, { step: 2, playId: 'paizuri' }, { step: 0, playId: 'deepthroat' }], ['deepthroat', 'paizuri'], 1)
  assert.deepEqual(pp, { plays: ['deepthroat'], playSteps: { deepthroat: 3 } })
  assert.deepEqual(preferredPlays([{ step: 3, playId: 'deepthroat' }], ['deepthroat'], 0).plays, [])
})

test('内置种族模板：每个种族一套、五步都写满且不超长、偏好 play 存在且属于该种族或通用', () => {
  assert.deepEqual(PRESET_FLOWS.map((f) => f.race).sort(), RACES.map((r) => r.name).sort())
  for (const f of PRESET_FLOWS) {
    assert.equal(f.actions.length, 5, f.race)
    for (const a of f.actions) { assert.ok(a.trim(), f.race); assert.ok(a.length <= STEP_ACTION_MAX, `${f.race} ${a}`) }
    assert.ok(f.name.length <= 10 && f.name.length > 0)
    assert.ok(f.plays!.length >= 1 && f.plays!.length <= 3, f.race)
    for (const p of f.plays!) {
      const def = ALL_PLAYS.find((x) => x.id === p.playId)
      assert.ok(def, p.playId); assert.ok(p.step >= 0 && p.step <= 4)
      if (def!.source === 'race') assert.equal(def!.race, f.race)
    }
    // 每套至少一个本种族 play（有的话）
    if (RACE_PLAYS[f.race]?.length) assert.ok(f.plays!.some((p) => p.playId.startsWith('race_')), f.race)
  }
  assert.equal(new Set(PRESET_FLOWS.map((f) => f.id)).size, PRESET_FLOWS.length)
})

test('内置模板：只读（不能改/删/设默认）、可复制、不占 5 个名额；复制后可改', () => {
  let s = migrateSave(mkSave())
  const cow = raceFlow('牛娘')!
  assert.equal(saveFlow(s, { id: cow.id, name: 'x', actions: [] }, newId).ok, false)
  assert.equal(deleteFlow(s, cow.id).ok, false)
  assert.equal(setDefaultFlow(s, cow.id).ok, false)
  assert.equal(getFlows(s.player).length, 1) // 内置不算名额
  const r = duplicateFlow(s, cow.id, newId); assert.ok(r.ok); s = r.save
  const copy = getFlows(s.player)[1]
  assert.equal(copy.name, cow.name); assert.deepEqual(copy.actions, cow.actions); assert.deepEqual(copy.plays, cow.plays)
  assert.ok(saveFlow(s, { id: copy.id, name: '我的奶香', actions: ['', '', '', '改过', ''] }, newId).ok)
  assert.equal(cow.actions[3], '以乳汁润滑温柔侍奉') // 内置本身不变
  // 用户模板满 5 个时仍能看到全部内置，但复制失败
  for (let i = 0; i < 3; i++) s = (saveFlow(s, { name: `t${i}`, actions: [] }, newId) as { save: GameSave }).save
  assert.equal(getFlows(s.player).length, MAX_FLOWS)
  assert.equal(duplicateFlow(s, raceFlow('龙娘')!.id, newId).ok, false)
  assert.equal(flowOptions(s.player, { race: '龙娘' }).length, MAX_FLOWS + PRESET_FLOWS.length)
})

test('准备页推荐：她的种族模板排第一；没有专属、全馆默认没被改过时默认选它', () => {
  let s = migrateSave(mkSave())
  const opts = flowOptions(s.player, { race: '龙娘' })
  assert.equal(opts[0].flow.id, raceFlow('龙娘')!.id); assert.ok(opts[0].suggested)
  assert.equal(opts.filter((o) => o.suggested).length, 1)
  assert.equal(defaultFlowChoice(s.player, { race: '龙娘' }), raceFlow('龙娘')!.id)
  const r = resolveFlow(s.player, { name: '露埃拉', race: '龙娘' })
  assert.equal(r.name, '龙巢君临'); assert.equal(r.actions[0], '端坐宝座俯视来客'); assert.ok(r.plays.some((p) => p.playId === 'race_dragon_press'))
  // 她有专属 → 专属优先
  assert.equal(defaultFlowChoice(s.player, { race: '龙娘', stepActions: ['她的', '', '', '', ''] }), FLOW_GIRL)
  // 没有种族模板的种族 → 全馆默认
  assert.equal(defaultFlowChoice(s.player, { race: '人类' }), STD_FLOW_ID)
  // 玩家改过全馆默认 → 尊重默认
  s = (saveFlow(s, { id: STD_FLOW_ID, name: '标准', actions: ['我的迎客', '', '', '', ''] }, newId) as { save: GameSave }).save
  assert.equal(defaultFlowChoice(s.player, { race: '龙娘' }), STD_FLOW_ID)
  // 显式选内置也能解析
  assert.equal(resolveFlow(s.player, { name: '千雪', race: '牛娘' }, raceFlow('狐娘')!.id).name, '九尾幻梦')
  // 存档里不会写入内置模板
  assert.ok(!getFlows(s.player).some((f) => f.id.startsWith('preset_')))
})
