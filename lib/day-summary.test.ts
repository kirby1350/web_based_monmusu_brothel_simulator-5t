import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { migrateSave, importSaveJson } from './migrate-save'
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

test('声望变化 = 当天各场实际变动之和；导入/改档跳变不算；截断按实际', () => {
  let s = start()
  const bad = fxGuest({ id: 'z', name: '路德', prefRace: '龙娘', prefTrait: '贫乳', prefOutfit: '制服' })
  const r = resolveService({ girl: { ...s.girls[0], obedience: 0, lewdness: 0, skillRanks: {}, stamina: 5 }, guest: bad, skip: false, roomLevel: 1 })
  const forced = { ...r, tier: { ...r.tier, key: 'unsatisfied' as const, label: '不满', reputationDelta: -2, regularChance: 0, payMult: 0.5 } }
  s = applyServiceToSave(s, 'qx', bad, forced, () => 0.99).save
  assert.equal(endDay(s, () => 0.99).lastDaySummary?.repDelta, -2)
  // 声望 1 时 −2 只实际掉 1
  let low: GameSave = { ...start(), player: { ...start().player, reputation: 1 } }
  low = applyServiceToSave(low, 'qx', bad, forced, () => 0.99).save
  assert.equal(endDay(low, () => 0.99).lastDaySummary?.repDelta, -1)
  // 导入一个声望 75 的存档：当天账本重开，小结不会显示 +75
  const imp = importSaveJson(JSON.stringify({ ...start(), player: { ...start().player, reputation: 75 } }))
  assert.ok('save' in imp)
  if ('save' in imp) assert.equal(endDay(imp.save, () => 0.99).lastDaySummary?.repDelta, 0)
  // 旧存档没有账本：迁移时补上，不把总值当变化
  const { dayLog: _x, ...noLog } = start()
  assert.equal(endDay(migrateSave(noLog as GameSave), () => 0.99).lastDaySummary?.repDelta, 0)
})

test('事件只列当天新出/已处理的，旧事件只合成一行计数', () => {
  const old = { kind: '接客失败' as const, text: '没能让客人路德满意', day: 6 }
  let s = migrateSave({ ...start(), currentDay: 7, girls: [fxGirl({ incident: old }), fxGirl({ id: 'b', name: '娜露梅亚', race: '精灵', incident: { kind: '闯祸', text: '偷懒被抓到', day: 5 } })] })
  // 当天处理掉娜露梅亚的事件
  s = { ...s, girls: s.girls.map((g) => (g.id === 'b' ? { ...g, incident: null } : g)) }
  const d = endDay(s, () => 0.99).lastDaySummary!
  assert.equal(d.unresolved, 1)
  assert.ok(!d.incidents.some((x) => x.text === old.text))
  assert.deepEqual(d.incidents.map((x) => [x.girl, x.status]), [['娜露梅亚', '已处理']])
  // 夜里新闯祸算「新」
  const s2 = migrateSave({ ...start(), currentDay: 7 })
  const d2 = endDay(s2, () => 0.1).lastDaySummary!
  assert.equal(d2.incidents.length, 1); assert.equal(d2.incidents[0].status, '新'); assert.equal(d2.unresolved, 0)
})
