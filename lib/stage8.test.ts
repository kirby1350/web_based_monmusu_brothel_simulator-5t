import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CustomProp, GameSave, MonstGirl } from './types'
import { CUSTOM_PROP_TEMPLATES, MAX_CUSTOM_PROPS, TRAINING_PROPS } from './catalog'
import { customPropPrice, createCustomProp, expandProps, getStepActions, normalizeStepActions } from './custom-props'
import { resolveTraining } from './resolve-training'
import { STEP_STANDARD_ACTION } from './live-steps'
import { migrateSave } from './migrate-save'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '狐娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15, 种族: 55 },
  skillRanks: { 口侍: '初学' }, skillProgress: { 口侍: 0 }, ...o,
})
const save = (gold = 5000, customProps: CustomProp[] = []): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold, day: 1, guestPreference: '', marketPreference: '', customProps },
  girls: [girl()], currentDay: 1, phase: 'morning', actionsUsedToday: 0,
})

test('定制价格 = 同档现成道具最高价 × 1.2，向上取整到 10G', () => {
  assert.equal(customPropPrice('tpl_progress'), 270)   // 练习镜 220
  assert.equal(customPropPrice('tpl_obedience'), 320)  // 驯服档最高 拘束架 260
  assert.equal(customPropPrice('tpl_lewd2'), 240)      // 放权档最高 按摩台 200
  assert.equal(customPropPrice('tpl_cm'), 290)         // 塑形架 240
  assert.equal(customPropPrice('tpl_zone_耳朵'), 270)  // 敏感档最高 220
  assert.equal(customPropPrice('nope'), null)
  assert.equal(CUSTOM_PROP_TEMPLATES.length, 12)
})

test('定制：扣金币、最多 6 件、名字必填、金币不足', () => {
  const r = createCustomProp(save(1000), { name: '金镜', desc: '描金', templateId: 'tpl_progress' }, 'c1')
  assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.player.gold, 730)
  assert.deepEqual(r.save.player.customProps, [{ id: 'c1', name: '金镜', desc: '描金', templateId: 'tpl_progress' }])
  const six = Array.from({ length: MAX_CUSTOM_PROPS }, (_, i) => ({ id: `x${i}`, name: 'x', desc: '', templateId: 'tpl_m' }))
  assert.equal(createCustomProp(save(5000, six), { name: 'y', desc: '', templateId: 'tpl_m' }).ok, false)
  assert.equal(createCustomProp(save(), { name: '  ', desc: '', templateId: 'tpl_m' }).ok, false)
  assert.equal(createCustomProp(save(100), { name: 'y', desc: '', templateId: 'tpl_m' }).ok, false)
})

test('每个模板的结算与对应现成道具一致；体力仍为 20', () => {
  const dirFor: Record<string, Parameters<typeof resolveTraining>[0]['direction']> = {
    whip: 'tame', rack: 'tame', massage_table: 'release', censer: 'release', mirror: 'drill', sculpt_frame: 'sculpt',
  }
  for (const t of CUSTOM_PROP_TEMPLATES) {
    const zone = TRAINING_PROPS.find((p) => p.id === t.baseProp)?.zone
    const g = girl({}), base = { girl: g, skip: true, roomLevel: 2 }
    const extra = zone ? { direction: 'sensitize' as const, zone } : dirFor[t.baseProp] === 'drill' ? { direction: 'drill' as const, skill: '口侍' as const }
      : dirFor[t.baseProp] === 'sculpt' ? { direction: 'sculpt' as const, potionId: 'bust_up' } : { direction: dirFor[t.baseProp] }
    const cp: CustomProp = { id: 'c', name: '定', desc: '', templateId: t.id }
    const a = resolveTraining({ ...base, ...extra, props: [t.baseProp] })
    const b = resolveTraining({ ...base, ...extra, props: ['c'], customProps: [cp] })
    assert.deepEqual(b.delta, a.delta, t.id)
    assert.equal(b.staminaCost, 20)
  }
})

test('同一效果只算一次；进度 +1 比空房多 1', () => {
  const cp: CustomProp = { id: 'c', name: '金镜', desc: '', templateId: 'tpl_progress' }
  assert.deepEqual(expandProps(['mirror', 'c'], [cp]), ['mirror'])
  const g = girl()
  const none = resolveTraining({ girl: g, direction: 'drill', skill: '口侍', skip: true, roomLevel: 2 })
  const withC = resolveTraining({ girl: g, direction: 'drill', skill: '口侍', skip: true, roomLevel: 2, props: ['c'], customProps: [cp] })
  const both = resolveTraining({ girl: g, direction: 'drill', skill: '口侍', skip: true, roomLevel: 2, props: ['c', 'mirror'], customProps: [cp] })
  assert.equal(withC.delta.skillProgress, none.delta.skillProgress + 1)
  assert.equal(both.delta.skillProgress, withC.delta.skillProgress)
})

test('标准做法：魔物娘 > 馆主 > 默认；规整与恢复默认', () => {
  assert.deepEqual(getStepActions(), [...STEP_STANDARD_ACTION])
  const player = { stepActions: ['', '馆主挑逗', '', '', ''] }
  assert.equal(getStepActions(player)[1], '馆主挑逗')
  assert.equal(getStepActions(player)[0], STEP_STANDARD_ACTION[0])
  assert.equal(getStepActions(player, { stepActions: ['', '她的挑逗', '', '', ''] })[1], '她的挑逗')
  assert.equal(normalizeStepActions(['', '', '', '', '']), undefined)
  assert.equal(normalizeStepActions(['a'.repeat(30)])![0].length, 20)
})

test('旧档迁移补 customProps，幂等，照常结算', () => {
  const old = { ...save(), player: { ...save().player, customProps: undefined } } as GameSave
  const m = migrateSave(old)
  assert.deepEqual(m.player.customProps, [])
  assert.deepEqual(migrateSave(m), m)
  assert.equal(resolveTraining({ girl: m.girls[0], direction: 'tame', skip: true, customProps: m.player.customProps }).ok, true)
})
