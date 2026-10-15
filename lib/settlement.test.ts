import { test } from 'node:test'
import { getSkillRank } from './catalog'
import assert from 'node:assert/strict'
import type { Guest, MonstGirl, GameSave } from './types'
import { resolveService, canSkipService, getAvailablePlays } from './resolve-service'
import { resolveTraining } from './resolve-training'
import { migrateSave } from './migrate-save'
import { calcServiceReward, createRandomGuest, evaluateSkillUnlocks } from './game-engine'

const baseGirl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'g1', name: '测试娘', race: '猫娘', age: '18', bodyDesc: '', bodyTags: '',
  bust: 88, waist: 62, hip: 90, personality: '', personalityTags: '', outfit: '', outfitTags: '',
  otherDesc: '', otherTags: '', affection: 50, obedience: 50, lewdness: 50, skills: [], imageTags: '', ...o,
})
const baseGuest = (o: Partial<Guest> = {}): Guest => ({
  id: 'c1', name: '雷克', race: '人类', personality: '', traits: [], desires: '想把高傲的魔物娘彻底操服',
  imageTags: '', satisfaction: 0, budget: 100, visits: 0, ...o,
})
const maxed = (o: Partial<MonstGirl> = {}) => baseGirl({
  race: '拉米亚', obedience: 90, lewdness: 90, waist: 58, bust: 100, hip: 100,
  skillRanks: { 待客: '精通', 手技: '精通', 身侍: '精通', 口侍: '精通', 'M性': '精通' },
  inclination: 'M', ...o,
})

test('一级房 + 常服 + 无 play 跳过：满意度不超过 70（即便能力打满）', () => {
  for (const girl of [baseGirl(), maxed(), maxed({ sensitivities: { 耳朵: 90, 阴蒂: 90, 小穴: 90 } })]) {
    for (const guest of [baseGuest(), baseGuest({ prefRace: girl.race, prefTrait: '巨乳', prefOutfit: '制服' })]) {
      const r = resolveService({ girl, guest, roomLevel: 1, outfit: 'regular', skip: true })
      assert.equal(r.plays.length, 0)
      assert.ok(r.satisfaction <= 70, `got ${r.satisfaction}`)
      r.steps.forEach((s) => assert.ok(s.score <= 14))
    }
  }
})

test('三级房 + 两个对口精通 play + 步骤打满：可以到 90 以上', () => {
  const guest = baseGuest({ prefRace: '拉米亚', prefTrait: '巨乳', prefOutfit: '制服' })
  const r = resolveService({ girl: maxed(), guest, roomLevel: 3, outfit: 'maid', skip: true })
  assert.equal(r.standardScore, 70)
  assert.equal(r.plays.length, 2)
  assert.ok(r.plays.every((p) => p.matched && p.rank === '精通'))
  assert.ok(r.satisfaction >= 90, `got ${r.satisfaction}`)
  assert.equal(r.tier.label, '极乐')
  // 敏感带加成后严格超过 90
  const r2 = resolveService({ girl: maxed({ sensitivities: { 唇舌: 80 } }), guest, roomLevel: 3, outfit: 'maid', skip: true })
  assert.ok(r2.satisfaction > 90, `got ${r2.satisfaction}`)
})

test('迎客服装：对口 +6、穿错 −2、常服 0', () => {
  const girl = baseGirl({ skillRanks: { 待客: '初学' } })
  const g = (o: Guest['prefOutfit']) => baseGuest({ prefOutfit: o, prefRace: undefined, prefTrait: undefined })
  const greet = (guest: Guest, outfit: any, stockings: any = 'none') =>
    resolveService({ girl, guest, outfit, stockings, skip: true }).steps[0].score
  assert.equal(greet(g('制服'), 'regular'), 4)
  assert.equal(greet(g('制服'), 'maid'), 10)
  assert.equal(greet(g('制服'), 'kimono'), 2)
  assert.equal(greet(g('黑丝'), 'maid', 'black'), 10)
})

test('跳过门槛：服从 <25 不能跳过，犬娘除外；跳过体力 −40', () => {
  assert.equal(canSkipService(baseGirl({ obedience: 24 })), false)
  assert.equal(canSkipService(baseGirl({ obedience: 24, race: '犬娘' })), true)
  assert.equal(canSkipService(baseGirl({ obedience: 25 })), true)
  const r = resolveService({ girl: baseGirl(), guest: baseGuest(), skip: true })
  assert.equal(r.staminaCost, 40)
})

test('龙娘跳过时清洗按服从七折', () => {
  const girl = baseGirl({ race: '龙娘', obedience: 80 })
  const skip = resolveService({ girl, guest: baseGuest(), skip: true })
  const live = resolveService({ girl, guest: baseGuest(), skip: false })
  assert.ok(skip.steps[4].score < live.steps[4].score)
})

test('正戏主类型不能再当 play；M/S 站反 −12；乳交需胸围 ≥80', () => {
  const girl = maxed({ race: '人类', skillRanks: { 身侍: '精通', 胸侍: '精通', 'M性': '精通' }, bust: 78 })
  const ids = getAvailablePlays(girl, baseGuest()).map((p) => p.id)
  assert.ok(!ids.includes('positions'))
  assert.ok(!ids.includes('paizuri'))
  const sGuest = baseGuest({ desires: '渴望被傲娇的魔物娘嫌弃着榨干' })
  const r = resolveService({ girl, guest: sGuest, roomLevel: 2, plays: ['endure'], skip: false })
  assert.equal(r.plays[0].score, -12)
})

test('收入不再按技能个数加钱', () => {
  assert.equal(calcServiceReward(baseGuest({ budget: 100, satisfaction: 70 })), 130)
  assert.deepEqual(evaluateSkillUnlocks(baseGirl({ obedience: 99, lewdness: 99, affection: 99 })), [])
})

test('新客人带需求标签', () => {
  const g = createRandomGuest(0)
  assert.ok(['M', 'S', '中性'].includes(g.desireKind!))
  assert.ok(g.desireService)
  assert.ok(g.prefOutfit === null || typeof g.prefOutfit === 'string')
})

test('调教基础值与倍率', () => {
  const girl = baseGirl({ obedience: 40, skillRanks: { 手技: '初学' } })
  const t1 = resolveTraining({ girl, direction: 'tame', roomLevel: 1, skip: true })
  assert.equal(t1.delta.obedience, 6); assert.equal(t1.delta.m, 5); assert.equal(t1.delta.affection, 1)
  assert.equal(resolveTraining({ girl, direction: 'tame', roomLevel: 4, skip: true }).delta.obedience, 12)
  const low = resolveTraining({ girl: baseGirl({ obedience: 20 }), direction: 'tame', skip: true })
  assert.equal(low.delta.obedience, 5) // 6 × 0.8 四舍五入
  const rel = resolveTraining({ girl, direction: 'release', skip: true })
  assert.equal(rel.delta.lewdness, 6); assert.equal(rel.delta.s, 5)
  const sc = resolveTraining({ girl, direction: 'sculpt', roomLevel: 4, potionId: 'bust_up', skip: true })
  assert.equal(sc.girl.bust, 93); assert.equal(sc.delta.lewdness, 2); assert.equal(sc.girl.sculptCounts!.bust, 1)
  const sen = resolveTraining({ girl: { ...girl, sensitivities: { 耳朵: 30 } }, direction: 'sensitize', zone: '耳朵', skip: true })
  assert.equal(sen.girl.sensitivities!['耳朵'], 40)
  let g = girl
  // 旧「初学」= 熟练度 30；特训每场 +10（50 以上 ×0.6）
  for (let i = 0; i < 2; i++) g = resolveTraining({ girl: g, direction: 'drill', skill: '手技', skip: true }).girl
  assert.equal(g.proficiency!['手技'], 50); assert.equal(getSkillRank(g, '手技'), '熟练')
  for (let i = 0; i < 4; i++) g = resolveTraining({ girl: g, direction: 'drill', skill: '手技', skip: true }).girl
  assert.equal(getSkillRank(g, '手技'), '熟练')
  g = resolveTraining({ girl: g, direction: 'drill', skill: '手技', skip: true }).girl
  assert.equal(g.proficiency!['手技'], 80); assert.equal(getSkillRank(g, '手技'), '精通')
})

test('旧档迁移：补默认值、保留旧技能、幂等', () => {
  const old = {
    player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 300, day: 2, guestPreference: '', marketPreference: '' },
    girls: [baseGirl({ skills: ['口技'] })],
    currentDay: 2, phase: 'morning',
    dailyGuests: [baseGuest({ desires: '渴望被傲娇的魔物娘嫌弃着榨干' })],
  } as unknown as GameSave
  const m = migrateSave(old)
  assert.equal(m.player.dormLevel, 1); assert.equal(m.player.serviceRoomLevel, 1); assert.equal(m.player.trainingRoomLevel, 1)
  assert.deepEqual(m.player.wardrobe, []); assert.deepEqual(m.player.inventory, {})
  assert.equal(m.player.gold, 300)
  const g = m.girls[0]
  assert.equal(g.stamina, 100); assert.deepEqual(g.skills, ['口技']); assert.deepEqual(g.skillRanks, {})
  assert.equal(g.sensitivities!['耳朵'], 30); assert.equal(g.sensitivities!['后庭'], 15); assert.equal(g.sensitivities!['种族'], 55)
  assert.equal(m.dailyGuests![0].desireKind, 'S')
  assert.equal(m.dailyGuests![0].prefOutfit, null)
  assert.deepEqual(migrateSave(m), m)
})
