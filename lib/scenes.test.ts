import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { fxGirl, fxPlayer, fxGuest } from './prompt-fixtures'
import {
  TRAINING_SCENES, getScene, sceneUnlocked, sceneUpkeep, sceneReaction, accumulateScene, sceneDecay, hasShadow,
  fetishMatchesGuest, FETISH_THRESHOLD, sceneRiskIncident, shadowLevel, provokeBlock, provokeEffect, detectShadowTrigger, rollSkipProvoke,
} from './scenes'
import { resolveTraining, resolveLiveTraining } from './resolve-training'
import { buyScene } from './shop'
import { applyTrainingToSave } from './settle-session'
import { endDay, setMachineNight } from './hub-logic'
import { resolveService } from './resolve-service'
import { trainingContext, girlStateCard, contextImageTags } from './prompt-context'
import { buildServiceSystemPrompt } from './prompt-builder'
import { addEvent, emptyMemory, girlMemoryBlock, localSummary, recordTraining, memOf } from './girl-memory'
import { createServiceSession } from './game-engine'
import { migrateSave } from './migrate-save'

const human = (o: Partial<MonstGirl> = {}) => fxGirl({ race: '人类', ...o })
const mkSave = (o: Partial<GameSave['player']> = {}, girls: MonstGirl[] = [human()]): GameSave =>
  migrateSave({ player: { ...fxPlayer, gold: 5000, ...o }, girls, currentDay: 5, phase: 'morning', actionsUsedToday: 0, dailyGuests: [] })

test('场景表：11 个（含 3 个放权场景），维护费合计 20，价格与维护单调大致对应', () => {
  assert.equal(TRAINING_SCENES.length, 11)
  const total = TRAINING_SCENES.reduce((a, s) => a + s.upkeep, 0)
  assert.equal(total, 20)
  assert.equal(TRAINING_SCENES.filter((s) => s.directions.includes('release') && !s.directions.includes('tame')).map((s) => s.id).join(','), 'altar,queen_room,throne,cradle')
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
  // 行动用满、b 出场了：b 只有宿舍恢复；a 挂机减半
  const n = endDay({ ...(m as { save: GameSave }).save, actionsUsedToday: 3, appearedToday: ['b'] }, () => 0.99)
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

const shadowWolf = (sp = 3) => human({ race: '狼娘', stamina: 100, sceneState: { dungeon: { uses: [], fp: 0, sp } } })

test('激发阴影：服从大涨、只多耗体力不扣好感、阴影加深、不长性癖、不能连续两天、递减', () => {
  const g = shadowWolf()
  assert.equal(shadowLevel(g, 'dungeon'), 1)
  const base = { girl: g, direction: 'tame' as const, skip: true, scene: 'dungeon' as const, day: 50 }
  const normal = resolveTraining(base)
  const pr = resolveTraining({ ...base, provoke: 'dungeon' })
  assert.ok(pr.ok)
  assert.equal(pr.delta.obedience - normal.delta.obedience, 8)
  assert.equal(pr.delta.affection, normal.delta.affection)
  assert.equal(pr.staminaCost - normal.staminaCost, 15)
  assert.equal(pr.girl.sceneState!.dungeon!.sp, 5); assert.equal(normal.girl.sceneState!.dungeon!.sp, 4)
  assert.equal(pr.girl.sceneState!.dungeon!.fp, 0)
  assert.deepEqual(pr.girl.provokedDays, [50]); assert.equal(pr.provokedScene, 'dungeon')
  assert.ok(pr.notes.some((n) => n.startsWith('激发阴影')))
  // 冷却：第二天不行，第三天行但 ×0.6
  assert.match(provokeBlock(pr.girl, 'dungeon', 51)!, /昨天/)
  assert.equal(resolveTraining({ ...base, girl: pr.girl, day: 51, provoke: 'dungeon' }).ok, false)
  assert.equal(provokeBlock(pr.girl, 'dungeon', 52), null)
  assert.equal(provokeEffect(pr.girl, 'dungeon', 52).obedience, 5)
  // 深层阴影：+2/层
  assert.equal(provokeEffect(shadowWolf(6), 'dungeon', 9).obedience, 10)
  assert.equal(provokeEffect(shadowWolf(9), 'dungeon', 9).obedience, 12)
  // 没阴影 / 觉醒清阴影后：不能激发
  assert.ok(provokeBlock(human(), 'dungeon', 5))
  assert.ok(provokeBlock({ ...g, awakened: ['dungeon'] }, 'dungeon', 5))
  // 在别的场景里激发地牢的阴影：地牢阴影 +2，本场景照常记使用但不长性癖
  const elsewhere = resolveTraining({ girl: { ...g, lewdness: 60 }, direction: 'tame', skip: true, scene: 'machine', day: 50, provoke: 'dungeon' })
  assert.ok(elsewhere.ok)
  assert.equal(elsewhere.girl.sceneState!.dungeon!.sp, 5)
  assert.equal(elsewhere.girl.sceneState!.machine!.fp, 0); assert.deepEqual(elsewhere.girl.sceneState!.machine!.uses, [50])
  // 任何方向都可能被激发（对话驱动），不限驯服
  assert.ok(resolveTraining({ girl: g, direction: 'release', skip: true, day: 50, provoke: 'dungeon' }).ok)
})

test('对话触发：阴影场景里的相关字眼 / 别处点名场景；冷却与无阴影不触发', () => {
  const g = shadowWolf()
  assert.equal(detectShadowTrigger(g, 'dungeon', '把锁链再收紧一点', 9), 'dungeon')
  assert.equal(detectShadowTrigger(g, 'dungeon', '抬起头看着我', 9), null)
  // 在别的场景 / 普通调教室：只有点名才算
  assert.equal(detectShadowTrigger(g, 'machine', '把锁链再收紧一点', 9), null)
  assert.equal(detectShadowTrigger(g, undefined, '再不听话，就把你关回地牢', 9), 'dungeon')
  assert.equal(detectShadowTrigger(g, undefined, '还记得 拘束 地牢 吗', 9), 'dungeon')
  // 冷却 / 没阴影
  assert.equal(detectShadowTrigger({ ...g, provokedDays: [8] }, 'dungeon', '锁链', 9), null)
  assert.equal(detectShadowTrigger(human(), undefined, '地牢', 9), null)
})

test('跳过触发：只在阴影场景里，按层数掷骰（40/65/90%），冷却内不掷', () => {
  const g = shadowWolf()
  assert.equal(rollSkipProvoke(g, 'dungeon', 9, () => 0.39), 'dungeon')
  assert.equal(rollSkipProvoke(g, 'dungeon', 9, () => 0.41), null)
  assert.equal(rollSkipProvoke(shadowWolf(9), 'dungeon', 9, () => 0.89), 'dungeon')
  assert.equal(rollSkipProvoke(g, 'machine', 9, () => 0), null)
  assert.equal(rollSkipProvoke(g, undefined, 9, () => 0), null)
  let used = false
  assert.equal(rollSkipProvoke({ ...g, provokedDays: [8] }, 'dungeon', 9, () => { used = true; return 0 }), null)
  assert.equal(used, false)
})

test('阴影不进接客：结算、提示词、夜间事件、心里话都不受影响', () => {
  const g = shadowWolf(), plain = human({ race: '狼娘', stamina: 100 })
  const guest = fxGuest()
  // 接客数值一致
  const a = resolveService({ girl: plain, guest, skip: true }), b = resolveService({ girl: g, guest, skip: true })
  assert.deepEqual(b.steps.map((x) => x.score), a.steps.map((x) => x.score)); assert.equal(b.satisfaction, a.satisfaction)
  // 接客提示词不带阴影；调教提示词带
  const withMem = addEvent({ ...g, memory: emptyMemory() }, { day: 4, kind: 'shadow', text: '拘束地牢成了她心里的阴影', w: 2, scene: 'dungeon' })
  const svc = buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [withMem], { guest }))
  assert.ok(!svc.includes('阴影'), svc)
  const tr = buildServiceSystemPrompt(fxPlayer, createServiceSession('training', [withMem], {}), 'standard', undefined, { scene: 'dungeon' })
  assert.ok(tr.includes('阴影：拘束地牢') && tr.includes('成了她心里的阴影'))
  assert.ok(girlMemoryBlock(withMem, { type: 'interaction' }).includes('阴影'))
  assert.ok(!girlMemoryBlock(withMem, { type: 'hub' }).includes('阴影'))
  assert.ok(!localSummary(withMem).includes('阴影'))
  assert.ok(!girlStateCard(g).includes('阴影') && girlStateCard(g, 5, { private: true }).includes('阴影'))
  // 调教上下文：激发时带【激发阴影】段
  assert.ok(trainingContext({ girl: g, direction: 'tame', skip: true, scene: 'dungeon', day: 9, provoke: 'dungeon' }).includes('【激发阴影】'))
  assert.ok(!trainingContext({ girl: g, direction: 'tame', skip: true, scene: 'dungeon', day: 9 }).includes('【激发阴影】'))
  // 激发写进记忆（私密）
  const pr = resolveTraining({ girl: withMem, direction: 'tame', skip: true, scene: 'dungeon', day: 9, provoke: 'dungeon' })
  const rec = recordTraining(pr.girl, withMem, pr, 9)
  assert.ok(memOf(rec).events.some((e) => e.kind === 'shadow' && e.text.includes('阴影被揭开')))
  // 夜里：有没有阴影，事件结果一样（不再有噩梦闯祸）
  for (const seed of [0.01, 0.05, 0.12, 0.5]) {
    const r1 = endDay(mkSave({}, [{ ...plain, id: 'w' }]), () => seed), r2 = endDay(mkSave({}, [{ ...g, id: 'w' }]), () => seed)
    assert.deepEqual(r2.girls[0].incident ?? null, r1.girls[0].incident ?? null)
  }
})

test('放权场景：女王调教室 / 王座间——S性、淫乱、好感、声望；亲和 / 抗拒 / 觉醒 / 风险', async () => {
  const { resolveTraining } = await import('./resolve-training')
  const { getScene, sceneRiskIncident, fetishMatchesGuest, accumulateScene, FETISH_THRESHOLD, hasShadow } = await import('./scenes')
  const mk = (race: string, o: Partial<import('./types').MonstGirl> = {}): import('./types').MonstGirl => ({
    id: 'x', name: 'X', race, age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 60, hip: 88, personality: '', personalityTags: '',
    outfit: '', outfitTags: '', otherDesc: '', otherTags: '', affection: 40, obedience: 40, lewdness: 50, skills: [], imageTags: '', stamina: 100,
    proficiency: { 口侍: 10, 胸侍: 10, 身侍: 10, 手技: 10, 待客: 10, M性: 0, S性: 10 }, ...o,
  })
  assert.deepEqual(getScene('queen_room')!.directions, ['release'])
  assert.deepEqual(getScene('throne')!.directions, ['release'])
  // 普通种族：放权基础 S性 +8，女王调教室再 +8、淫乱 +3、好感 +1
  const plain = resolveTraining({ girl: mk('猫娘'), direction: 'release', skip: true })
  const q = resolveTraining({ girl: mk('猫娘'), direction: 'release', skip: true, scene: 'queen_room', day: 1 })
  assert.equal(q.delta.s, plain.delta.s + 8)
  assert.equal(q.delta.lewdness, plain.delta.lewdness + 3)
  assert.equal(q.delta.affection, plain.delta.affection + 1)
  assert.equal(q.girl.proficiency!['S性'], 10 + 16)
  // 王座间：S性 +10、声望 +1、体力 +5；龙娘亲和淫乱主项 +2
  const t = resolveTraining({ girl: mk('龙娘'), direction: 'release', skip: true, scene: 'throne', day: 1 })
  assert.equal(t.delta.s, plain.delta.s + 10)
  assert.equal(t.delta.lewdness, plain.delta.lewdness + 2 + 2)
  assert.equal(t.reputationDelta, 1)
  assert.equal(t.staminaCost, 25)
  // 不适合的方向
  assert.equal(resolveTraining({ girl: mk('猫娘'), direction: 'tame', skip: true, scene: 'throne' }).ok, false)
  // 抗拒：兔娘在女王调教室好感 −3+1、淫乱 −2，积累阴影
  const bun = resolveTraining({ girl: mk('兔娘'), direction: 'release', skip: true, scene: 'queen_room', day: 1 })
  assert.equal(bun.delta.affection, plain.delta.affection + 1 - 3)
  let g = mk('兔娘')
  for (let d = 1; d <= 3; d++) g = accumulateScene(g, 'queen_room', d * 10).girl
  assert.ok(hasShadow(g, 'queen_room'))
  // 觉醒：女王癖 / 支配欲，对上 S 向客人
  let dg = mk('龙娘', { lewdness: 60 })
  for (let d = 1; d <= 3; d++) dg = accumulateScene(dg, 'throne', d * 10).girl
  assert.ok(dg.awakened!.includes('throne'), `fp ${dg.sceneState?.throne?.fp} / ${FETISH_THRESHOLD}`)
  const sGuest = { id: 'c', name: 'c', race: '人类', personality: '', traits: [], desires: '渴望被傲娇的魔物娘嫌弃着榨干', imageTags: '', satisfaction: 0, budget: 100, visits: 0 }
  assert.ok(fetishMatchesGuest('throne', sGuest) && fetishMatchesGuest('queen_room', sGuest))
  // 王座间风险：服从 <30 时 20% 恃宠而骄
  assert.ok(sceneRiskIncident('throne', mk('龙娘'), mk('龙娘', { obedience: 20 }), 3, () => 0.1))
  assert.equal(sceneRiskIncident('throne', mk('龙娘'), mk('龙娘', { obedience: 40 }), 3, () => 0.1), null)
})
