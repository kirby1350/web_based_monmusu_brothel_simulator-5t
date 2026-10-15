import test from 'node:test'
import assert from 'node:assert/strict'
import { ARCHETYPES, DIFFICULTIES, applyArchetype, archetypeGirls, getArchetype, getDifficulty } from './archetypes'
import { buildStartingSave } from './starting-roster'
import { themeCooldownLeft } from './store-theme'
import { migrateSave } from './migrate-save'
import type { Player } from './types'

const base: Player = { name: '老板', storeName: '月下馆', traits: [], customTraits: '', fetishes: [], gold: 500, day: 1, guestPreference: '', marketPreference: '' }
let n = 0
const nid = () => `id${n++}`

test('开局类型：金币/设施/场景/衣橱/主题/两位姑娘各不相同；预设姑娘都存在', () => {
  for (const a of ARCHETYPES) {
    const girls = archetypeGirls(a, nid)
    assert.equal(girls.length, a.girls.length, a.id)
    girls.forEach((g) => assert.ok(g.proficiency && g.imageUrl !== undefined))
  }
  const p = applyArchetype(base, getArchetype('dungeon'), getDifficulty('normal'))
  assert.equal(p.gold, 350); assert.equal(p.trainingRoomLevel, 2); assert.deepEqual(p.ownedScenes, ['dungeon']); assert.equal(p.storeTheme, 'M系')
  const b = applyArchetype(base, getArchetype('busty'), getDifficulty('easy'))
  assert.equal(b.gold, 600); assert.equal(b.reputation, 10); assert.equal(b.serviceRoomLevel, 2); assert.deepEqual(b.wardrobe, ['maid'])
  assert.equal(applyArchetype(base, getArchetype('balanced'), getDifficulty('hard')).gold, 300)
  assert.equal(new Set(ARCHETYPES.map((a) => a.gold)).size, ARCHETYPES.length)
  assert.equal(DIFFICULTIES.length, 3)
})

test('开局存档：主题客人、严苛难度客人更挑剔、开局主题当天能改；迁移不丢新字段且幂等', () => {
  const a = getArchetype('exotic')
  const p = applyArchetype(base, a, getDifficulty('hard'))
  const [g1, g2] = archetypeGirls(a, nid)
  const s = buildStartingSave(p, g1, g2, nid)
  assert.equal(s.player.storeName, '月下馆')
  assert.ok(s.dailyGuests!.every((g) => g.themeTag === '异种' && (g.demand ?? 0) >= 3))
  assert.equal(themeCooldownLeft(s), 0)
  const m1 = migrateSave(s), m2 = migrateSave(m1)
  assert.deepEqual(m1, m2)
  assert.equal(m1.player.archetype, 'exotic'); assert.equal(m1.player.difficulty, 'hard'); assert.equal(m1.player.storeTheme, '异种')
  assert.equal(m1.player.trainingRoomLevel ?? 1, 1)
  // 旧存档：没有这些字段也能读，难度按标准
  const old = migrateSave({ ...s, player: { ...s.player, archetype: undefined, difficulty: undefined, storeName: undefined } })
  assert.equal(getDifficulty(old.player.difficulty).id, 'normal')
})
