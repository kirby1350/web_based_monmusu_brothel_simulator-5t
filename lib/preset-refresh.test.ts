import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameSave, MonstGirl } from './types'
import { GIRL_TEMPLATES } from './game-data'
import { PRESET_TEXT_HISTORY } from './preset-history'
import { presetTextHash } from './preset-hash'
import { refreshPresetText, PRESET_TEXT_FIELDS } from './preset-refresh'
import { migrateSave } from './migrate-save'

// 上一版（ai-guests 分支）的预设文案快照，模拟老存档里的预设角色
const OLD = JSON.parse(readFileSync(join(process.cwd(), 'lib/fixtures/presets-v1.json'), 'utf8')) as Omit<MonstGirl, 'id' | 'imageUrl'>[]
// 上一版（outfits-1 分支，口癖之前）的快照
const V2 = JSON.parse(readFileSync(join(process.cwd(), 'lib/fixtures/presets-v2.json'), 'utf8')) as Omit<MonstGirl, 'id' | 'imageUrl'>[]
const v2Girl = (name: string, extra: Partial<MonstGirl> = {}): MonstGirl =>
  ({ ...V2.find((t) => t.name === name)!, id: name, imageUrl: '/x.jpg', ...extra }) as MonstGirl
const oldGirl = (name: string, extra: Partial<MonstGirl> = {}): MonstGirl =>
  ({ ...OLD.find((t) => t.name === name)!, id: name, imageUrl: '/x.jpg', ...extra }) as MonstGirl

test('预设文案：新文案不在旧指纹里（否则无法幂等），旧快照字段都在指纹里', () => {
  for (const t of GIRL_TEMPLATES) {
    for (const k of PRESET_TEXT_FIELDS) {
      const h = PRESET_TEXT_HISTORY[t.name]?.[k] ?? []
      assert.ok(!h.includes(presetTextHash(t[k] as string)), `${t.name}.${k}`)
      for (const snap of [OLD, V2]) {
        const o = snap.find((x) => x.name === t.name)
        const ov = o?.[k]
        if (typeof ov === 'string' && ov !== t[k]) assert.ok(h.includes(presetTextHash(ov)), `old ${t.name}.${k}`)
      }
    }
  }
})

test('老存档的预设角色：文本字段刷新，数值/进度/立绘不动，幂等', () => {
  const g = oldGirl('志希', { affection: 61, obedience: 44, lewdness: 70, skillRanks: { 待客: '熟练' }, skills: ['按摩'], imageUrl: 'data:custom' })
  const r = refreshPresetText(g)
  const tpl = GIRL_TEMPLATES.find((t) => t.name === '志希')!
  for (const k of PRESET_TEXT_FIELDS) assert.equal(r[k], tpl[k], k)
  assert.equal(r.affection, 61); assert.equal(r.obedience, 44); assert.equal(r.lewdness, 70)
  assert.deepEqual(r.skillRanks, { 待客: '熟练' }); assert.equal(r.imageUrl, 'data:custom'); assert.deepEqual(r.skills, ['按摩'])
  assert.deepEqual(refreshPresetText(r), r)
})

test('玩家改过的字段（如换了常服）保留', () => {
  const r = refreshPresetText(oldGirl('文香', { outfit: '自己挑的黑色旗袍', outfitTags: 'black qipao' }))
  assert.equal(r.outfit, '自己挑的黑色旗袍'); assert.equal(r.outfitTags, 'black qipao')
  assert.equal(r.otherDesc, GIRL_TEMPLATES.find((t) => t.name === '文香')!.otherDesc)
  assert.ok(!r.otherDesc.includes('阿拉克涅'))
})

test('同名但不同种族（自建角色）不刷新', () => {
  const g = oldGirl('千雪', { race: '狐娘' })
  assert.deepEqual(refreshPresetText(g), g)
})

test('娜露梅亚三围：原样且没塑形才更新；塑形过的保留', () => {
  const a = refreshPresetText(oldGirl('娜露梅亚', { sculptCounts: { bust: 0, waist: 0, hip: 0 } }))
  assert.deepEqual([a.bust, a.waist, a.hip], [108, 58, 90])
  const b = refreshPresetText(oldGirl('娜露梅亚', { bust: 110, sculptCounts: { bust: 1, waist: 0, hip: 0 } }))
  assert.deepEqual([b.bust, b.waist, b.hip], [110, 60, 92])
})

test('migrateSave 带上刷新：旧种族名阿拉克涅的文香也能刷新，且整体幂等', () => {
  const save = { player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 1, day: 3, guestPreference: '', marketPreference: '' },
    girls: [oldGirl('文香', { race: '阿拉克涅' }), oldGirl('娜露梅亚')], currentDay: 3, phase: 'morning' } as unknown as GameSave
  const m = migrateSave(save)
  assert.equal(m.girls[0].race, '蜘蛛娘')
  assert.equal(m.girls[0].outfit, GIRL_TEMPLATES.find((t) => t.name === '文香')!.outfit)
  assert.ok(!m.girls[1].bodyTags.includes('tanned'))
  assert.deepEqual(migrateSave(m), m)
})

test('上一版存档（无口癖）：OOC 修正与口癖补上，年龄刷新；数值与三围不动', () => {
  for (const tpl of GIRL_TEMPLATES.filter((t) => V2.some((o) => o.name === t.name))) {
    const g = v2Girl(tpl.name, { affection: 77, bust: 101, sculptCounts: { bust: 2, waist: 0, hip: 0 } })
    assert.equal(g.speechStyle, undefined)
    const r = refreshPresetText(g)
    for (const k of PRESET_TEXT_FIELDS) assert.equal(r[k], tpl[k], `${tpl.name}.${k}`)
    assert.ok(r.speechStyle && r.speechStyle.includes('自称'), tpl.name)
    assert.equal(r.affection, 77); assert.equal(r.bust, 101)
    assert.deepEqual(refreshPresetText(r), r)
  }
  const n = refreshPresetText(v2Girl('娜露梅亚'))
  assert.equal(n.age, '24'); assert.ok(!n.bodyTags.includes('wakizashi')); assert.ok(n.speechStyle!.includes('馆主酱'))
  assert.equal(refreshPresetText(v2Girl('文香')).age, '19')
  assert.ok(!refreshPresetText(v2Girl('文香')).imageTags.includes('glasses'))
})

test('玩家手改过的年龄 / 口癖保留', () => {
  const r = refreshPresetText(v2Girl('文香', { age: '25', speechStyle: '自称：本小姐' }))
  assert.equal(r.age, '25'); assert.equal(r.speechStyle, '自称：本小姐')
})
