import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, Inclination, MonstGirl, SkillKey, SkillRank } from './types'
import {
  profRank, initialProficiency, withInitialProficiency, proficiencyFromLegacy, deriveInclination, growProficiency, addProf,
  PROF_SKILLS, SERVING_PROF_SKILLS, SERVICE_PROF_CAP, PROF_INIT_CAP,
} from './proficiency'
import { getSkillRank, getInclination, defaultSensitivities } from './catalog'
import { resolveService, getAvailablePlays, getMainService } from './resolve-service'
import { applyServiceToSave } from './settle-session'
import { migrateGirl, migrateSave, SAVE_VERSION } from './migrate-save'
import { createRandomGuest } from './game-engine'
import { GIRL_TEMPLATES } from './game-data'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'g1', name: '测试娘', race: '猫娘', age: '18', bodyDesc: '', bodyTags: '',
  bust: 88, waist: 62, hip: 90, personality: '', personalityTags: '', outfit: '', outfitTags: '',
  otherDesc: '', otherTags: '', affection: 40, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100, ...o,
})
const guest = (o: Partial<Guest> = {}): Guest => ({
  id: 'c1', name: '雷克', race: '人类', personality: '', traits: [], desires: '想被温柔地口交',
  imageTags: '', satisfaction: 0, budget: 100, visits: 0, ...o,
})
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff } }

test('分档：<25 未学、25 初学、50 熟练、75 精通', () => {
  assert.equal(profRank(24.9), undefined)
  assert.equal(profRank(25), '初学'); assert.equal(profRank(49), '初学')
  assert.equal(profRank(50), '熟练'); assert.equal(profRank(75), '精通'); assert.equal(profRank(100), '精通')
  assert.equal(getSkillRank(girl({ proficiency: { 口侍: 60 } }), '口侍'), '熟练')
  assert.equal(getSkillRank(girl({ proficiency: { 口侍: 10 } }), '口侍'), undefined)
})

test('初始值：每项 ≤45，最多 3 项服侍技能入门；牛娘胸侍、狐娘待客有种族加成', () => {
  for (const t of GIRL_TEMPLATES as MonstGirl[]) {
    const p = initialProficiency(t)
    for (const k of PROF_SKILLS) assert.ok(p[k] >= 0 && p[k] <= PROF_INIT_CAP, `${t.name} ${k}`)
    assert.ok(SERVING_PROF_SKILLS.filter((k) => p[k] >= 25).length <= 3, t.name)
  }
  const cow = (GIRL_TEMPLATES as MonstGirl[]).find((t) => t.name === '千雪')!
  assert.equal(initialProficiency(cow)['胸侍'], 45)
  const fox = (GIRL_TEMPLATES as MonstGirl[]).find((t) => t.race === '狐娘')!
  assert.equal(getSkillRank(withInitialProficiency(fox), '待客'), '初学')
  // 幂等：已有熟练度不动
  const g = withInitialProficiency(girl({ proficiency: { 口侍: 70 } }))
  assert.equal(g.proficiency!['口侍'], 70)
})

test('递减：<50 ×1、50–74 ×0.6、≥75 ×0.3；上限截断', () => {
  assert.equal(addProf(40, 10), 50)
  assert.equal(addProf(50, 10), 56)
  assert.equal(addProf(80, 10), 83)
  assert.equal(addProf(73, 10, 74), 74)
  assert.equal(addProf(74, 10, 74), 74)
  assert.equal(addProf(99, 10), 100)
})

test('倾向由 M性 / S性 推出；两面保持', () => {
  assert.equal(deriveInclination({ proficiency: { M性: 24, S性: 10 } }), '无')
  assert.equal(deriveInclination({ proficiency: { M性: 30, S性: 30 } }), 'M')
  assert.equal(deriveInclination({ proficiency: { M性: 30, S性: 31 } }), 'S')
  assert.equal(deriveInclination({ proficiency: { M性: 0, S性: 0 }, inclination: '两面' }), '两面')
  // 承受调教要 M 倾向且 M性 ≥25
  const g = girl({ proficiency: { M性: 30, S性: 5 } })
  assert.equal(getInclination(g), 'M')
  assert.ok(getAvailablePlays(g, guest()).some((p) => p.id === 'endure'))
  assert.ok(!getAvailablePlays(girl({ proficiency: { M性: 20 } }), guest()).some((p) => p.id === 'endure'))
})

test('接客：主服务 +2、待客/手技/play 来源 +1；亲自上场 ×1.5；最多练到 74', () => {
  const c = guest({ desires: '想被温柔地口交' })
  const main = getMainService(c)
  const g = girl({ proficiency: { 口侍: 10, 胸侍: 10, 身侍: 10, [main]: 30, 待客: 30, 手技: 30, M性: 0, S性: 0 } })
  const skip = resolveService({ girl: g, guest: c, skip: true })
  assert.equal(skip.profGains[main], 2); assert.equal(skip.profGains['待客'], 1); assert.equal(skip.profGains['手技'], 1 + (skip.plays.some((p) => p.id === 'long_massage') ? 1 : 0))
  const live = resolveService({ girl: g, guest: c, skip: false, plays: [] })
  assert.equal(live.profGains[main], 3)
  const save: GameSave = { player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 1, guestPreference: '', marketPreference: '' }, girls: [g], currentDay: 1, phase: 'morning', actionsUsedToday: 0, dailyGuests: [c] }
  const r = applyServiceToSave(save, g.id, c, skip, () => 0.99)
  assert.equal(r.save.girls[0].proficiency![main], 32)
  assert.ok(r.info.profChanges!.some((x) => x.skill === main && x.from === 30 && x.to === 32))
  const capped = growProficiency(girl({ proficiency: { 口侍: 73.5 } }), { 口侍: 2 }, SERVICE_PROF_CAP)
  assert.equal(capped.girl.proficiency!['口侍'], 74)
  assert.equal(growProficiency(capped.girl, { 口侍: 2 }, SERVICE_PROF_CAP).changes.length, 0)
})

test('迁移 v3：旧档位换算、倾向不变、幂等', () => {
  const old = girl({ race: '牛娘', skillRanks: { 口侍: '熟练', 待客: '初学', 'M性': '初学' }, skillProgress: { 口侍: 1 }, inclination: 'M', msProgress: { m: 20, s: 7 } })
  const m = migrateGirl(old)
  assert.equal(m.proficiency!['口侍'], 60)
  assert.equal(m.proficiency!['待客'], 30)
  assert.equal(m.proficiency!['胸侍'], 30, '牛娘胸侍旧特判 = 初学')
  assert.ok(m.proficiency!['身侍']! < 25)
  assert.equal(m.proficiency!['M性'], 49, 'M性 ×5 但不跨出旧档位')
  assert.ok(m.proficiency!['S性']! < m.proficiency!['M性']!)
  assert.equal(m.inclination, 'M')
  assert.deepEqual(migrateGirl(m), m)
  const none = migrateGirl(girl({ msProgress: { m: 10, s: 0 } }))
  assert.equal(getInclination(none), '无')
  const two = migrateGirl(girl({ inclination: '两面', skillRanks: { 'M性': '熟练' } }))
  assert.equal(getInclination(two), '两面')
  assert.equal(SAVE_VERSION, 3)
  const save = migrateSave({ player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 3, guestPreference: '', marketPreference: '' }, girls: [old], currentDay: 3, phase: 'morning', saveVersion: 2 } as GameSave)
  assert.equal(save.saveVersion, 3)
  assert.deepEqual(migrateSave(save), save)
})

test('迁移前后接客得分完全一样（随机旧档 × 随机客人 × 跳过/上场 × 房间等级）', () => {
  const r = rng(7)
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  const ranks: (SkillRank | undefined)[] = [undefined, undefined, '初学', '熟练', '精通']
  const races = ['猫娘', '牛娘', '犬娘', '龙娘', '狐娘', '拉米亚', '精灵', '兔娘']
  const incls: Inclination[] = ['无', 'M', 'S', '两面']
  const origRandom = Math.random
  Math.random = r
  try {
    for (let i = 0; i < 150; i++) {
      const skillRanks: Partial<Record<SkillKey, SkillRank>> = {}
      for (const k of SERVING_PROF_SKILLS) { const x = pick(ranks); if (x) skillRanks[k] = x }
      const inclination = pick(incls)
      if (inclination === 'M' || inclination === '两面') skillRanks['M性'] = pick(['初学', '熟练', '精通'] as const)
      if (inclination === 'S') skillRanks['S性'] = pick(['初学', '熟练', '精通'] as const)
      const old = girl({
        id: `o${i}`, race: pick(races), obedience: Math.floor(r() * 100), lewdness: Math.floor(r() * 100), affection: Math.floor(r() * 100),
        bust: 75 + Math.floor(r() * 40), hip: 80 + Math.floor(r() * 30), skillRanks, inclination,
        skillProgress: { 口侍: Math.floor(r() * 2) }, msProgress: { m: Math.floor(r() * 30), s: Math.floor(r() * 30) },
      })
      old.sensitivities = { ...defaultSensitivities(old.race), 后庭: Math.floor(r() * 100) }
      const neu = migrateGirl(old)
      for (let j = 0; j < 4; j++) {
        const c = createRandomGuest(1 + Math.floor(r() * 3))
        for (const skip of [true, false]) {
          const roomLevel = 1 + Math.floor(r() * 3)
          const a = resolveService({ girl: old, guest: c, skip, roomLevel })
          const b = resolveService({ girl: neu, guest: c, skip, roomLevel })
          assert.equal(b.satisfaction, a.satisfaction, `#${i} ${old.race} ${JSON.stringify(skillRanks)} ${inclination} vs ${JSON.stringify(neu.proficiency)}`)
          assert.deepEqual(b.plays.map((p) => p.id), a.plays.map((p) => p.id))
        }
      }
    }
  } finally { Math.random = origRandom }
})
