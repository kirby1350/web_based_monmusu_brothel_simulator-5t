import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { migrateSave } from './migrate-save'
import { endDay } from './hub-logic'
import { applyServiceToSave, applyTrainingToSave } from './settle-session'
import { resolveService } from './resolve-service'
import { resolveTraining } from './resolve-training'
import { dismissDaySummary, NEAR_REGULAR_SAT } from './day-summary'
import { fxGirl, fxGuest, fxPlayer } from './prompt-fixtures'

const start = (): GameSave => migrateSave({ player: { ...fxPlayer, gold: 500, reputation: 10 }, girls: [fxGirl(), fxGirl({ id: 'b', name: '娜露梅亚', race: '精灵' })], currentDay: 3, phase: 'morning', dailyGuests: [] })

test('结束今天生成小结：收入、场次评价、最佳、潜在回头客、事件、数值变化；关闭即清空', () => {
  let s = start()
  const t = resolveTraining({ girl: s.girls[1], direction: 'tame', skip: true, roomLevel: 1 })
  s = applyTrainingToSave(s, t)
  const g1 = fxGuest({ id: 'x', name: '王老板' }), g2 = fxGuest({ id: 'y', name: '李掌柜', prefRace: undefined, prefTrait: undefined, prefOutfit: null })
  const r1 = resolveService({ girl: s.girls[0], guest: g1, skip: false, roomLevel: 1, outfit: 'regular', stockings: 'black' })
  s = applyServiceToSave(s, 'qx', g1, r1, () => 0).save          // 抽中回头客（若满意）
  const r2 = resolveService({ girl: s.girls[0], guest: g2, skip: false, roomLevel: 1 })
  s = applyServiceToSave(s, 'qx', g2, r2, () => 0.99).save
  s = { ...s, player: { ...s.player, gold: s.player.gold - 100 } } // 当天花了 100
  const n = endDay(s, () => 0.99)
  const d = n.lastDaySummary!
  assert.equal(d.day, 3)
  assert.equal(d.income, r1.reward + r2.reward)
  assert.equal(d.spent, 100)
  assert.equal(Object.values(d.tiers).reduce((a, b) => a + b, 0), 2)
  assert.equal(d.best?.sat, Math.max(r1.satisfaction, r2.satisfaction))
  for (const r of d.regulars) assert.ok(r.rolled || r.sat >= NEAR_REGULAR_SAT)
  assert.ok(d.stats.some((x) => x.girl === '娜露梅亚' && x.ob > 0), JSON.stringify(d.stats))
  assert.equal(n.dayLog?.day, 4); assert.equal(n.dayLog?.services.length, 0)
  assert.equal(dismissDaySummary(n).lastDaySummary, null)
})

test('没接客的一天也有小结；夜间事件会列出', () => {
  const n = endDay(start(), () => 0.1)
  assert.equal(n.lastDaySummary?.income, 0)
  assert.equal(n.lastDaySummary?.incidents.length, 1)
  assert.equal(n.lastDaySummary?.best, undefined)
})
