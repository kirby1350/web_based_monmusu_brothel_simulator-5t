import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveService, skillRankBonus, getMainService } from './resolve-service'
import { fxGirl, fxGuest } from './prompt-fixtures'

const guest = fxGuest({ prefRace: undefined, prefTrait: undefined, prefOutfit: null })

test('技能档对口加成：熟练 +5、精通 +9，按迎客/前戏/正戏各算', () => {
  const main = getMainService(guest)
  assert.equal(skillRankBonus(fxGirl({ skillRanks: {} }), main).total, 0)
  assert.equal(skillRankBonus(fxGirl({ skillRanks: { 待客: '初学' } }), main).total, 0)
  assert.equal(skillRankBonus(fxGirl({ skillRanks: { 待客: '熟练' } }), main).total, 5)
  assert.equal(skillRankBonus(fxGirl({ skillRanks: { 待客: '精通', 手技: '熟练', [main]: '精通' } }), main).total, 23)
})

test('练到熟练后亲自上场满意度明显上升', () => {
  const main = getMainService(guest)
  const lo = resolveService({ girl: fxGirl({ skillRanks: { [main]: '初学' } }), guest, skip: false, roomLevel: 1 })
  const hi = resolveService({ girl: fxGirl({ skillRanks: { [main]: '熟练' } }), guest, skip: false, roomLevel: 1 })
  assert.ok(hi.satisfaction - lo.satisfaction >= 8, `${lo.satisfaction} → ${hi.satisfaction}`)
})

test('精通特权「游刃有余」：低体力也让对应步骤满分', () => {
  const main = getMainService(guest)
  const tired = { stamina: 10 }
  const r = resolveService({ girl: fxGirl({ ...tired, skillRanks: { [main]: '精通' } }), guest, skip: false, roomLevel: 1 })
  assert.equal(r.steps.find((s) => s.key === 'main')!.score, 14)
  assert.ok(r.raceNotes.some((n) => n.startsWith('游刃有余')))
  const r2 = resolveService({ girl: fxGirl({ ...tired, skillRanks: { [main]: '熟练' } }), guest, skip: false, roomLevel: 1 })
  assert.ok(r2.steps.find((s) => s.key === 'main')!.score < 14)
})
