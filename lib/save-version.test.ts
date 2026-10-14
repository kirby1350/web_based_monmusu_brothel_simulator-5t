import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { migrateSave, exportSaveJson, importSaveJson, SAVE_VERSION } from './migrate-save'

// 模拟一个最早期（v0）的存档：没有 saveVersion、设施、体力、敏感带等字段，种族用旧名
const v0 = (day = 5): GameSave => JSON.parse(JSON.stringify({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 120, day, guestPreference: '', marketPreference: '' },
  girls: [{ id: 'a', name: 'A', race: '美杜莎', age: '', bodyDesc: '', bodyTags: '', bust: 80, waist: 60, hip: 85,
    personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
    affection: 10, obedience: 10, lewdness: 10, skills: [], imageTags: '' }],
  currentDay: day, phase: 'morning',
}))

test('v0 旧存档能迁移到当前版本，字段补齐、种族改名', () => {
  const m = migrateSave(v0())
  assert.equal(m.saveVersion, SAVE_VERSION)
  assert.equal(m.player.dormLevel, 1)
  assert.deepEqual(m.player.wardrobe, [])
  assert.equal(m.girls[0].race, '拉米亚')
  assert.equal(m.girls[0].stamina, 100)
  assert.equal(m.actionsUsedToday, 0)
  // 已过第一天的老存档不弹引导
  assert.deepEqual(m.tutorial, { step: 0, dismissed: true })
})

test('第一天的新存档：引导未关闭', () => {
  assert.deepEqual(migrateSave(v0(1)).tutorial, { step: 0, dismissed: false })
})

test('migrateSave 幂等，且保留已有引导进度', () => {
  const once = migrateSave({ ...v0(1), tutorial: { step: 2, dismissed: false } })
  assert.deepEqual(migrateSave(once), once)
  assert.equal(once.tutorial?.step, 2)
})

test('导出 → 导入 往返一致', () => {
  const m = migrateSave(v0())
  const r = importSaveJson(exportSaveJson(m))
  assert.ok('save' in r)
  if ('save' in r) {
    const strip = ({ dayLog: _a, lastDaySummary: _b, ...rest }: GameSave) => rest
    assert.deepEqual(strip(r.save), strip(m))
    assert.equal(r.save.lastDaySummary, null)
  }
})

test('导入 v0 JSON 会自动迁移', () => {
  const r = importSaveJson(JSON.stringify(v0()))
  assert.ok('save' in r && r.save.saveVersion === SAVE_VERSION && r.save.girls[0].race === '拉米亚')
})

test('导入非法内容 / 未来版本被拒', () => {
  assert.ok('error' in importSaveJson('not json'))
  assert.ok('error' in importSaveJson('{"foo":1}'))
  assert.ok('error' in importSaveJson(JSON.stringify({ ...v0(), saveVersion: SAVE_VERSION + 1 })))
})
