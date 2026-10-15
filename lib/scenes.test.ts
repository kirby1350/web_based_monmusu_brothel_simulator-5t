import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { fxGirl, fxPlayer, fxGuest } from './prompt-fixtures'
import {
  TRAINING_SCENES, getScene, sceneUnlocked, sceneUpkeep, sceneReaction, accumulateScene, sceneDecay, hasShadow,
  fetishMatchesGuest, FETISH_THRESHOLD, sceneRiskIncident, nightmareIncident,
} from './scenes'
import { resolveTraining, resolveLiveTraining } from './resolve-training'
import { buyScene } from './shop'
import { applyTrainingToSave } from './settle-session'
import { endDay, setMachineNight } from './hub-logic'
import { resolveService } from './resolve-service'
import { trainingContext, girlStateCard, contextImageTags } from './prompt-context'
import { buildServiceSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { migrateSave } from './migrate-save'

const human = (o: Partial<MonstGirl> = {}) => fxGirl({ race: '人类', ...o })
const mkSave = (o: Partial<GameSave['player']> = {}, girls: MonstGirl[] = [human()]): GameSave =>
  migrateSave({ player: { ...fxPlayer, gold: 5000, ...o }, girls, currentDay: 5, phase: 'morning', actionsUsedToday: 0, dailyGuests: [] })

test('场景表：8 个，维护费合计 16，价格与维护单调大致对应', () => {
  assert.equal(TRAINING_SCENES.length, 8)
  const total = TRAINING_SCENES.reduce((a, s) => a + s.upkeep, 0)
  assert.equal(total, 16)
  for (const s of TRAINING_SCENES) { assert.ok(s.upkeep >= 1 && s.upkeep <= 3); assert.ok(s.directions.length >= 1) }
})

test('解锁与购买：条件、重复、金币不足', () => {
  const s = mkSave({ trainingRoomLevel: 1, reputation: 0, dormLevel: 1 })
  assert.equal(sceneUnlocked(s, 'dungeon'), true)
  assert.equal(sceneUnlocked(s, 'tentacle'), false)
  const r = buyScene(s, 'tentacle'); assert.equal(r.ok, false); assert.match((r as { error: string }).error, /调教室 Lv3/)
  // 催眠室：有狐娘就解锁
  assert.equal(sceneUnlocked(mkSave({ trainingRoomLevel: 1 }, [fxGirl()]), 'hypnosis'), true)
  const b = buyScene(s, 'dungeon'); assert.ok(b.ok)
  if (b.ok) {
    assert.equal(b.save.player.gold, 5000 - 600); assert.deepEqual(b.save.player.ownedScenes, ['dungeon'])
    assert.equal(buyScene(b.save, 'dungeon').ok, false)
  }
  assert.equal(buyScene(mkSave({ gold: 10 }), 'dungeon').ok, false)
})

test('场景加成固定、不吃倍率；不对口方向报错', () => {
  const g = human({ obedience: 30 })
  const lv1 = resolveTraining({ girl: g, direction: 'tame', skip: false, roomLevel: 1, scene: 'tentacle', day: 5 })
  const lv4 = resolveTraining({ girl: g, direction: 'tame', skip: false, roomLevel: 4, scene: 'tentacle', day: 5 })
  assert.equal(lv1.delta.obedience, 6 + 8); assert.equal(lv4.delta.obedience, 12 + 8)
  assert.equal(lv1.delta.lewdness, 3); assert.equal(lv1.delta.affection, 1 - 3)
  assert.equal(lv1.staminaCost, 35)
  assert.equal(resolveTraining({ girl: g, direction: 'sculpt', skip: false, scene: 'tentacle', potionId: 'bust_up' }).ok, false)
  const hyp = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'hypnosis', day: 5 })
  assert.equal(hyp.delta.obedience, 16); assert.equal(hyp.delta.affection, 1)
  const onsen = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'onsen', day: 5 })
  assert.equal(onsen.delta.affection, 6); assert.equal(onsen.staminaCost, 10)
  // 无场景时与旧结算完全一致
  const plain = resolveTraining({ girl: g, direction: 'tame', skip: false })
  assert.equal(plain.delta.obedience, 6); assert.equal(plain.girl.sceneState, g.sceneState)
})

test('亲和 / 抗拒：主项 ±2，好感不扣 / 再 −3', () => {
  const slime = human({ race: '史莱姆' }), dragon = human({ race: '龙娘' })
  assert.equal(sceneReaction(slime, 'tentacle'), 'affinity'); assert.equal(sceneReaction(dragon, 'tentacle'), 'aversion')
  const a = resolveTraining({ girl: slime, direction: 'tame', skip: false, scene: 'tentacle', day: 1 })
  assert.equal(a.delta.obedience, 6 + 8 + 2); assert.equal(a.delta.affection, 1)
  const v = resolveTraining({ girl: dragon, direction: 'tame', skip: false, scene: 'tentacle', day: 1 })
  assert.equal(v.delta.obedience, 6 + 8 - 2); assert.equal(v.delta.affection, 1 - 3 - 3)
})

test('7 天内重复使用递减：1 / 0.85 / 0.7 / 0.6；超出窗口恢复', () => {
  let g = human()
  const obs: number[] = []
  for (let d = 1; d <= 4; d++) { const r = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'tentacle', day: d }); obs.push(r.delta.obedience - 6); g = r.girl }
  assert.deepEqual(obs, [8, 7, 6, 5])
  assert.equal(sceneDecay(g, 'tentacle', 20), 1)
  // 催眠：前一天用过减半
  const h1 = resolveTraining({ girl: human(), direction: 'tame', skip: false, scene: 'hypnosis', day: 3 })
  const h2 = resolveTraining({ girl: h1.girl, direction: 'tame', skip: false, scene: 'hypnosis', day: 4 })
  assert.equal(h2.delta.obedience - 6, Math.round(Math.round(10 * 0.85) / 2))
})

test('性癖觉醒：亲和 + 淫乱≥50 第 3 次觉醒；觉醒后不扣好感、主项 +2', () => {
  let g = human({ race: '史莱姆', lewdness: 55 })
  const notes: string[][] = []
  for (let d = 1; d <= 3; d++) { const r = resolveTraining({ girl: g, direction: 'release', skip: false, scene: 'tentacle', day: d * 3 }); notes.push(r.notes); g = r.girl; if (d < 3) assert.equal(r.awakenedScene, undefined); else assert.equal(r.awakenedScene, 'tentacle') }
  assert.deepEqual(g.awakened, ['tentacle'])
  assert.ok(notes[2].some((n) => n.includes('觉醒性癖「触手癖」')))
  const after = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'tentacle', day: 30 })
  assert.equal(after.delta.affection, 1 + 1)
  // 淫乱不够不觉醒
  let low = human({ lewdness: 20 })
  for (let d = 1; d <= 12; d++) low = accumulateScene(low, 'dungeon', d * 10).girl
  assert.ok((low.sceneState!.dungeon!.fp) >= FETISH_THRESHOLD); assert.equal(low.awakened?.includes('dungeon') ?? false, false)
})

test('阴影：抗拒种族 3 次后生效、再扣好感；温泉每次 −1；觉醒清阴影', () => {
  let g = human({ race: '狼娘' })
  for (let d = 1; d <= 3; d++) g = accumulateScene(g, 'dungeon', d * 10).girl
  assert.equal(hasShadow(g, 'dungeon'), true)
  const r = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'dungeon', day: 50 })
  assert.equal(r.delta.affection, 1 - 2 - 3 - 2)
  assert.ok(r.notes.some((n) => n.startsWith('阴影')))
  g = accumulateScene(g, 'onsen', 60).girl
  assert.equal(g.sceneState!.dungeon!.sp, 2); assert.equal(hasShadow(g, 'dungeon'), false)
  // 夜里噩梦：有阴影才掷骰
  let s3 = human({ race: '狼娘' }); for (let d = 1; d <= 3; d++) s3 = accumulateScene(s3, 'dungeon', d * 10).girl
  assert.ok(nightmareIncident(s3, 9, () => 0.05)); assert.equal(nightmareIncident(s3, 9, () => 0.5), null)
  assert.equal(nightmareIncident(human(), 9, () => 0), null)
})

test('结算写档：声望、风险事件只在有风险时掷骰', () => {
  const s = mkSave({ ownedScenes: ['stage', 'dungeon'], reputation: 40 }, [human({ affection: 20 })])
  const g = s.girls[0]
  const r = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'stage', day: 5 })
  const n = applyTrainingToSave(s, r, undefined, () => 0.1)
  assert.equal(n.player.reputation, 41); assert.equal(n.girls[0].incident?.kind, '闯祸')
  let calls = 0
  const r2 = resolveTraining({ girl: g, direction: 'tame', skip: false, scene: 'dungeon', day: 5 })
  applyTrainingToSave(s, r2, undefined, () => { calls++; return 0 })
  assert.equal(calls, 0)
  assert.ok(sceneRiskIncident('hypnosis', g, g, 5, () => 0.01)); assert.equal(sceneRiskIncident('hypnosis', g, g, 5, () => 0.5), null)
})

test('结束今天：扣维护费、挂机服从 +3 与体力减半、写进小结', () => {
  const s = { ...mkSave({ ownedScenes: ['machine', 'dungeon'], gold: 100, dormLevel: 1 }, [human({ id: 'a', stamina: 40 }), human({ id: 'b', stamina: 40 })]) }
  const m = setMachineNight(s, 'a'); assert.ok(m.ok)
  const n = endDay((m as { save: GameSave }).save, () => 0.99)
  assert.equal(n.player.gold, 97)
  assert.equal(n.lastDaySummary?.upkeep, 3)
  const a = n.girls.find((g) => g.id === 'a')!, b = n.girls.find((g) => g.id === 'b')!
  assert.equal(a.obedience, 38 + 3); assert.equal(a.stamina, 40 + 12); assert.equal(b.stamina, 40 + 25)
  assert.deepEqual(a.sceneState?.machine?.uses, [5]); assert.ok(n.lastDaySummary?.night?.includes('机械调教室'))
  assert.equal(n.machineNightGirlId, undefined)
  // 出场过的人不能挂；没机械室不能挂；金币不够扣到 0
  assert.equal(setMachineNight({ ...s, appearedToday: ['a'] }, 'a').ok, false)
  assert.equal(setMachineNight(mkSave(), 'qx').ok, false)
  assert.equal(endDay(mkSave({ ownedScenes: ['altar'], gold: 1 }), () => 0.99).player.gold, 0)
  // 没有场景：不扣钱、小结不带 upkeep
  const plain = endDay(mkSave({ gold: 100 }), () => 0.99)
  assert.equal(plain.player.gold, 100); assert.equal(plain.lastDaySummary?.upkeep, undefined)
  assert.equal(sceneUpkeep({ ...fxPlayer, ownedScenes: ['altar', 'onsen'] }), 4)
})

test('觉醒性癖对上客人口味：迎客 +2', () => {
  const guestM = fxGuest({ desires: '想粗暴支配她', desireKind: 'M', prefRace: undefined, prefTrait: undefined, prefOutfit: null })
  assert.equal(fetishMatchesGuest('dungeon', guestM), true); assert.equal(fetishMatchesGuest('altar', guestM), false)
  const base = resolveService({ girl: human(), guest: guestM, skip: true })
  const lit = resolveService({ girl: human({ awakened: ['dungeon', 'hypnosis'] }), guest: guestM, skip: true })
  assert.equal(lit.steps[0].score - base.steps[0].score, 2)
  assert.ok(lit.raceNotes.some((n) => n.includes('拘束癖')))
  assert.equal(fetishMatchesGuest('stage', fxGuest({ prefOutfit: '暴露' })), true)
})

test('提示词：场景地点、反应、性癖不改性格；无场景时不变', () => {
  const g = human({ race: '史莱姆', awakened: ['tentacle'] })
  const ctx = trainingContext({ girl: g, direction: 'tame', skip: true, scene: 'tentacle', day: 3 })
  assert.ok(ctx.includes('【调教场景】触手房') && ctx.includes('已觉醒「触手癖」'))
  assert.ok(!trainingContext({ girl: g, direction: 'tame', skip: true }).includes('调教场景'))
  assert.ok(girlStateCard(g).includes('觉醒性癖：触手癖'))
  const sess = createServiceSession('training', [g], {})
  const sp = buildServiceSystemPrompt(fxPlayer, sess, 'standard', undefined, { scene: 'tentacle' })
  assert.ok(sp.includes(getScene('tentacle')!.place)); assert.ok(sp.includes('不要改变她的性格、自称与口癖'))
  const plain = buildServiceSystemPrompt(fxPlayer, createServiceSession('training', [human()], {}))
  assert.ok(plain.includes('墙上挂满皮鞭') && !plain.includes('后天觉醒'))
  assert.ok(contextImageTags(g, { scene: 'training', trainingScene: 'tentacle' }).includes('tentacles'))
})

test('亲自上场：场景加成照样生效，只写一两句减半', () => {
  const g = human()
  const r = resolveLiveTraining({ girl: g, direction: 'tame', scene: 'dungeon', day: 2 }, 1, 0)
  assert.equal(r.delta.obedience, Math.floor((6 + 4) / 2))
  assert.deepEqual(r.girl.sceneState?.dungeon?.uses, [2])
})

test('迁移：ownedScenes 缺省为空', () => {
  const s = migrateSave({ player: { ...fxPlayer }, girls: [], currentDay: 1, phase: 'morning' } as GameSave)
  assert.deepEqual(s.player.ownedScenes, [])
})
