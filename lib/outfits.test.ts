import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MonstGirl, OutfitId } from './types'
import { OUTFITS, STOCKINGS, OUTFIT_PREFS, OUTFIT_PREF_WEIGHTS, pickOutfitPref, outfitName } from './catalog'
import { resolveTraining } from './resolve-training'
import { resolveService } from './resolve-service'
import { createRandomGuest } from './game-engine'
import { sanitizeAiGuest } from './ai-guests'
import { fxGuest } from './prompt-fixtures'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  skillRanks: { 待客: '初学' }, skillProgress: {},
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 }, ...o,
})
const train = (outfit: OutfitId | undefined, o: Record<string, unknown> = {}) =>
  resolveTraining({ girl: girl(), skip: false, roomLevel: 1, outfit, direction: 'tame', ...o } as Parameters<typeof resolveTraining>[0])

test('衣橱：18 件衣服 + 5 种丝袜，id 唯一，每件有价格区间、喜好合法、描写', () => {
  assert.equal(OUTFITS.length, 18); assert.equal(STOCKINGS.length, 6)
  assert.equal(new Set(OUTFITS.map((o) => o.id)).size, 18)
  for (const o of [...OUTFITS, ...STOCKINGS].filter((x) => x.price > 0)) {
    assert.ok(o.pref && OUTFIT_PREFS.includes(o.pref), o.id)
    assert.ok(o.price >= 120 && o.price <= 260, o.id)
    assert.ok(o.desc && o.desc.length > 10, o.id)
  }
  // 每个喜好至少有一件可买的对口物品
  for (const p of OUTFIT_PREFS) assert.ok([...OUTFITS, ...STOCKINGS].some((o) => o.pref === p && o.price > 0), p)
  // 旧 id 不变（存档安全），只改显示名
  for (const id of ['regular', 'maid', 'kimono', 'crotchless', 'restraint', 'queen']) assert.ok(OUTFITS.some((o) => o.id === id))
  assert.equal(outfitName('crotchless'), '开裆蕾丝情趣内衣')
})

test('服装喜好按权重抽取：新喜好 0.7，黑丝/白丝/暴露 1.2', () => {
  assert.deepEqual([OUTFIT_PREF_WEIGHTS['兔女郎'], OUTFIT_PREF_WEIGHTS['异域'], OUTFIT_PREF_WEIGHTS['圣洁']], [0.7, 0.7, 0.7])
  assert.deepEqual([OUTFIT_PREF_WEIGHTS['黑丝'], OUTFIT_PREF_WEIGHTS['白丝'], OUTFIT_PREF_WEIGHTS['暴露']], [1.2, 1.2, 1.2])
  // 确定性：均匀扫描 [0,1) 得到的频率与权重成正比
  const n = 10000; const cnt: Record<string, number> = {}
  for (let i = 0; i < n; i++) { const p = pickOutfitPref(() => (i + 0.5) / n); cnt[p] = (cnt[p] ?? 0) + 1 }
  const total = Object.values(OUTFIT_PREF_WEIGHTS).reduce((a, b) => a + b, 0)
  for (const p of OUTFIT_PREFS) assert.ok(Math.abs(cnt[p] / n - OUTFIT_PREF_WEIGHTS[p] / total) < 0.002, p)
  assert.equal(pickOutfitPref(() => 0.999999), '圣洁')
})

test('生成的客人喜好都在列表里；AI 客人可改写成新喜好，非法值被丢弃', () => {
  for (let i = 0; i < 200; i++) { const g = createRandomGuest(i % 2 ? 0 : 90); assert.ok(g.prefOutfit === null || OUTFIT_PREFS.includes(g.prefOutfit!)) }
  assert.equal(sanitizeAiGuest({ prefOutfit: '圣洁' }, fxGuest({ prefOutfit: '黑丝' })).prefOutfit, '圣洁')
  assert.equal(sanitizeAiGuest({ prefOutfit: '比基尼' }, fxGuest({ prefOutfit: '黑丝' })).prefOutfit, '黑丝')
})

test('新衣服对口迎客 +4（衣服或丝袜任一对上）', () => {
  const base = resolveService({ girl: girl(), guest: fxGuest({ prefOutfit: '圣洁' }), skip: true, outfit: 'regular', stockings: 'none' })
  for (const [outfit, stockings] of [['nun', 'none'], ['bridal', 'none'], ['regular', 'lace_white']] as const) {
    const r = resolveService({ girl: girl(), guest: fxGuest({ prefOutfit: '圣洁' }), skip: true, outfit, stockings })
    assert.ok(r.outfitMatched, outfit + stockings)
    assert.equal(r.steps[0].score, Math.min(base.steps[0].score + 4, r.steps[0].score), outfit)
  }
  assert.ok(resolveService({ girl: girl(), guest: fxGuest({ prefOutfit: '暴露' }), skip: true, outfit: 'maid', stockings: 'fishnet' }).outfitMatched)
})

test('新衣服的调教加成', () => {
  const ob = (o?: OutfitId) => train(o).delta.obedience
  assert.equal(ob('nun') - ob(undefined), 1)
  const pm = (o?: OutfitId) => train(o, { direction: 'punish', girl: girl({ incident: { kind: '闯祸', text: 'x', day: 1 } }) }).delta.m
  assert.equal(pm('harness') - pm(undefined), 1)
  const lw = (o?: OutfitId) => train(o, { direction: 'release' }).delta.lewdness
  for (const o of ['babydoll', 'latex', 'queen'] as const) assert.equal(lw(o) - lw(undefined), 1, o)
  const sens = (o: OutfitId | undefined, zone: string, props: string[] = []) => train(o, { direction: 'sensitize', zone, props }).delta.sensitivity
  assert.equal(sens('bunny', '耳朵') - sens(undefined, '耳朵'), 2)
  assert.equal(sens('bunny', '耳朵', ['feather']) - sens(undefined, '耳朵', ['feather']), 0) // 有耳羽不叠加
  assert.equal(sens('sling', '乳房') - sens(undefined, '乳房'), 2)
  assert.equal(sens('sling', '乳房', ['nipple_clamps']) - sens(undefined, '乳房', ['nipple_clamps']), 0)
  assert.equal(sens('bunny', '乳房') - sens(undefined, '乳房'), 0)
  const dr = (o: OutfitId | undefined, props: string[] = []) => train(o, { direction: 'drill', skill: '待客', props }).delta.skillProgress
  assert.equal(dr('dancer') - dr(undefined), 1)
  assert.equal(dr('dancer', ['mirror']) - dr(undefined, ['mirror']), 0) // 有练习镜不叠加
  const aff = (o?: OutfitId) => train(o, { direction: 'release' }).delta.affection
  assert.equal(aff('bridal') - aff(undefined), 1)
})
