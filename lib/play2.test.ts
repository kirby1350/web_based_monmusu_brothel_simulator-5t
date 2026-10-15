import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lengthReminder, withTurnSuffix, REPLY_LENGTH, trimHistory } from './prompt-context'
import { buildServiceSystemPrompt, buildInteractionSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { fxPlayer, fxGirl, fxGuest } from './prompt-fixtures'
import type { ChatMessage } from './types'

test('字数：服务/调教/私聊提示词都要求 300–500 字；重油仍是 500–800', () => {
  const sv = buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [fxGirl()], { guest: fxGuest() }))
  const tr = buildServiceSystemPrompt(fxPlayer, createServiceSession('training', [fxGirl()], {}))
  const ch = buildInteractionSystemPrompt(fxPlayer, fxGirl(), 'chat')
  for (const p of [sv, tr, ch]) assert.ok(p.includes(`${REPLY_LENGTH.min}-${REPLY_LENGTH.max}字`) || p.includes(`正文${REPLY_LENGTH.min}-${REPLY_LENGTH.max}字`))
  assert.ok(buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [fxGirl()], { guest: fxGuest() }), 'dense').includes('正文500-800字'))
  assert.ok(!ch.includes('50-100字'))
})

test('字数提醒只接在本次请求的最后一条玩家消息上，不改原消息', () => {
  const msgs: ChatMessage[] = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }, { role: 'assistant', content: 'd' }]
  const sfx = lengthReminder('service')
  const out = withTurnSuffix(trimHistory(msgs, 6), sfx)
  assert.equal(out[0].content, 'a'); assert.equal(out[2].content, 'c' + sfx); assert.equal(msgs[2].content, 'c')
  assert.deepEqual(withTurnSuffix(msgs, undefined), msgs)
  assert.ok(lengthReminder('chat').includes('300–500'))
  assert.ok(lengthReminder('training').includes('STATS'))
})

import { resolveTraining } from './resolve-training'
import { trainingContext } from './prompt-context'
import { sceneReaction, getScene, fetishMatchesGuest, detectShadowTrigger, accumulateScene, FETISH_THRESHOLD } from './scenes'
import { buildTrainingOpeningPrompt } from './prompt-builder'
import { GIRL_TEMPLATES } from './game-data'

test('摇篮寝殿：只放权；牛娘/精灵/拉米亚或母性性格亲和，猫娘抗拒；S性 +6、好感为正、体力少耗', () => {
  const def = getScene('cradle')!
  assert.deepEqual(def.directions, ['release']); assert.equal(def.fetish, '母性沉溺')
  const chiyuki = { ...fxGirl(), ...GIRL_TEMPLATES.find((t) => t.name === '千雪')! }
  const narumeia = { ...fxGirl(), ...GIRL_TEMPLATES.find((t) => t.name === '娜露梅亚')! }
  assert.equal(sceneReaction(chiyuki, 'cradle'), 'affinity')
  assert.equal(sceneReaction(fxGirl({ race: '人类', personality: '温柔包容的大姐姐' }), 'cradle'), 'affinity')
  assert.equal(sceneReaction(fxGirl({ race: '人类', personality: '冷淡' }), 'cradle'), 'neutral')
  assert.equal(sceneReaction(fxGirl({ race: '猫娘', personality: '任性' }), 'cradle'), 'aversion')
  assert.equal(sceneReaction(narumeia, 'cradle'), 'affinity')
  const g = fxGirl({ race: '人类', personality: '冷淡', stamina: 100 })
  const base = resolveTraining({ girl: g, direction: 'release', skip: true, day: 5 })
  const r = resolveTraining({ girl: g, direction: 'release', skip: true, scene: 'cradle', day: 5 })
  assert.equal(r.delta.s - base.delta.s, 6)
  assert.ok(r.delta.affection > base.delta.affection)
  assert.equal(resolveTraining({ girl: g, direction: 'tame', skip: true, scene: 'cradle', day: 5 }).ok, false)
  // 觉醒后对 M 客人 / 想撒娇的客人对口
  assert.ok(fetishMatchesGuest('cradle', fxGuest({ desires: '想被温柔地宠着' })))
  assert.ok(detectShadowTrigger({ sceneState: { cradle: { uses: [], fp: 0, sp: 3 } } }, 'cradle', '乖孩子，听妈妈的话', 6))
  // 反复使用会觉醒「母性沉溺」
  let x = chiyuki as typeof g
  for (let d = 1; d <= 10 && !(x.awakened ?? []).includes('cradle'); d++) x = accumulateScene(x, 'cradle', d).girl
  assert.ok((x.awakened ?? []).includes('cradle'))
  void FETISH_THRESHOLD
})

test('调教开场白提示词：带场景、方向、反应、阴影、性癖、口癖规则与字数', () => {
  const g = fxGirl({ awakened: ['onsen'], sceneState: { cradle: { uses: [], fp: 0, sp: 3 } } })
  const info = trainingContext({ girl: g, direction: 'release', skip: true, scene: 'cradle', day: 6 })
  const p = buildTrainingOpeningPrompt(fxPlayer, g, { directionLabel: '放权', scene: 'cradle', day: 6, trainingInfo: info, extra: '【惩罚缘由】打碎了花瓶' })
  for (const k of ['摇篮寝殿', '放权', '250-400字', '甘宠癖', '阴影', '母性', '打碎了花瓶', '千雪']) assert.ok(p.includes(k), k)
  const plain = buildTrainingOpeningPrompt(fxPlayer, fxGirl(), { directionLabel: '驯服' })
  assert.ok(plain.includes('调教室') && plain.includes('驯服'))
})

import { CASES, STYLES, runLive } from '../scripts/live-sat-table'
import { resolveService } from './resolve-service'
import { initLiveState, recordTurn, nextStep, resolveLiveSteps, recordModelStats, topicHit, liveMatchBonus, turnKind } from './live-steps'
import { initHeat, heatTurn, speechBand, heatPromptBlock, heatSatBonus, HEAT_MAX } from './arousal'

test('亲自上场满意度示例：敷衍 ≤ 跳过；每步 1 条对口 > 跳过；每步 3 条对口明显高于跳过', () => {
  for (const c of CASES) {
    const skip = resolveService({ girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, plays: c.plays, roomLevel: c.roomLevel, skip: true }).satisfaction
    const [lazy, plain, topic, engaged] = STYLES.map((st) => runLive(c, st).satisfaction)
    assert.ok(lazy <= skip && lazy >= skip - 8, `${c.name} 敷衍 ${lazy} vs 跳过 ${skip}`)
    assert.ok(Math.abs(plain - skip) <= 5, `${c.name} 普通 ${plain} vs ${skip}`)
    assert.ok(topic > skip, `${c.name} 对口 ${topic} vs ${skip}`)
    assert.ok(engaged >= Math.min(100, skip + 10), `${c.name} 投入 ${engaged} vs ${skip}`)
  }
  // 新人这一例的具体数（文档里的表）
  const c = CASES[0]
  assert.deepEqual(STYLES.map((st) => runLive(c, st).satisfaction), [53, 59, 64, 85])
})

test('模型满意度：每回合 ±2、每步 ±3、整场 −6~+8；敷衍回合不算', () => {
  const c = CASES[0]
  const plan = { girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, roomLevel: 1 }
  let s = initLiveState(plan)
  s = recordTurn(s, { text: '贴耳低语撩拨他，慢慢来' }); s = recordModelStats(s, 20)
  assert.equal(s.model![0], 2)
  s = recordTurn(s, { text: '贴耳低语撩拨他，慢慢来' }); s = recordModelStats(s, 20)
  assert.equal(s.model![0], 3) // 每步封顶 3
  s = recordTurn(s, { text: '嗯' }); s = recordModelStats(s, 20)
  assert.equal(s.model![0], 3)
  for (let i = 1; i < 5; i++) { s = nextStep(s); for (let k = 0; k < 3; k++) { s = recordTurn(s, { text: '认真地照着做这一步' }); s = recordModelStats(s, 20) } }
  assert.equal(resolveLiveSteps(plan, s).live.model, 8) // 整场封顶 8
  assert.equal(turnKind('嗯嗯', true), 'short')
})

test('准备页选的 play（含流程模板预选）在亲自上场同样计分', () => {
  const c = CASES[1]
  const plan = { girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, roomLevel: c.roomLevel, plays: c.plays }
  const s = initLiveState(plan)
  assert.deepEqual(s.plays.map((p) => p.id), c.plays)
  assert.ok(resolveLiveSteps(plan, s).playScore > 0)
  assert.equal(liveMatchBonus(15, [['topic'], ['plain'], [], ['topic'], []]), Math.round(15 * (0.5 + 0.5 * 2 / 5)))
})

test('对口判定：需求、做法、部位、正戏主类型关键词', () => {
  const ctx = { desires: '想被痴女主动求欢', stepIndex: 3, stepAction: '开始正式侍奉', mainSkill: '口侍' }
  assert.ok(topicHit('她跪下去用舌头含住', ctx))
  assert.ok(topicHit('她主动求欢地扑上来', { ...ctx, stepIndex: 0 }))
  assert.ok(!topicHit('今天天气不错', ctx))
})

test('兴奋/快感：偏好命中时客人起步高；正戏快感上升，到顶记高潮并回落；说话档位随之变化', () => {
  const g = CASES[1].girl
  const hit = initHeat({ ...CASES[1].guest, prefRace: g.race, prefTrait: '巨乳' }, [g])
  const miss = initHeat({ ...CASES[1].guest, prefRace: '龙娘', prefTrait: '贫乳', prefOutfit: undefined }, [g])
  assert.ok(hit.guest.arousal >= miss.guest.arousal + 30)
  let h = hit
  const input = { guest: CASES[1].guest, girls: [g], mainSkill: '口侍', zone: '唇舌' as const, onTopic: true, text: '用力地含住' }
  let climaxed = false
  for (let i = 0; i < 10; i++) { h = heatTurn(h, { ...input, stepIndex: 3 }); if (h.justClimaxed.includes('guest')) climaxed = true }
  assert.ok(climaxed && h.guest.climaxes >= 1)
  assert.ok(h.guest.pleasure < HEAT_MAX)
  assert.equal(speechBand({ arousal: 10, pleasure: 0, climaxes: 0 }), '从容')
  assert.equal(speechBand({ arousal: 50, pleasure: 70, climaxes: 0 }), '慌乱')
  assert.equal(speechBand({ arousal: 90, pleasure: 90, climaxes: 0 }), '临界')
  assert.equal(speechBand({ arousal: 0, pleasure: 0, climaxes: 1 }, true), '高潮')
  const block = heatPromptBlock(h, '王老板', [g])
  assert.ok(block.includes('兴奋') && block.includes('口癖保持不变'.slice(0, 2)) && block.includes(g.name))
  assert.ok(heatSatBonus(h) >= 3 && heatSatBonus(h) <= 5)
  // 清洗：快感回落
  const cooled = heatTurn(h, { ...input, stepIndex: 4 })
  assert.ok(cooled.guest.pleasure < h.guest.pleasure || h.guest.pleasure === 0)
})

import { partnerSynergy, applyPartners, maxPartners, partnerEligible, SYNERGY_CAP } from './multi-service'
import { applyServiceToSave } from './settle-session'

test('多人服务：默契加成明细、第二位 ×0.6、封顶；房间 3 级才能三人', () => {
  const c = CASES[1]
  const lead = c.girl
  const p1 = { ...c.girl, id: 'p1', name: '甲', affection: 70, obedience: 50 }
  const p2 = { ...c.girl, id: 'p2', name: '乙', race: '龙娘', affection: 10, obedience: 10, proficiency: undefined, skillRanks: {} }
  const one = partnerSynergy({ ...lead, affection: 70 }, [p1], c.guest)
  assert.ok(one.total >= 4 && one.parts[0].includes('姐妹配合') && one.parts[0].includes('默契'))
  const two = partnerSynergy({ ...lead, affection: 70 }, [p1, p2], c.guest)
  assert.ok(two.total <= SYNERGY_CAP && two.parts[1].includes('×0.6') && two.parts[1].includes('不肯配合'))
  assert.equal(maxPartners(1), 1); assert.equal(maxPartners(3), 2)
  assert.equal(partnerEligible({ ...p1, stamina: 10 }, lead.id), '体力不足 25')
  assert.equal(partnerEligible(lead, lead.id), '主位')
  const base = resolveService({ girl: lead, guest: c.guest, outfit: c.outfit, stockings: c.stockings, plays: c.plays, roomLevel: 3, skip: true })
  const r = applyPartners(base, { girl: lead, guest: c.guest, partners: [p1] })
  assert.equal(r.satisfaction, Math.min(100, base.satisfaction + r.synergy!))
  assert.ok(r.reward > base.reward)
  assert.equal(r.partnerStamina!.p1, Math.round(base.staminaCost * 0.6))
})

test('多人服务结算：一次行动；协同扣体力、记接客记忆、拿一半熟练度、记出场', () => {
  const c = CASES[1]
  const lead = { ...c.girl, id: 'L' }
  const p1 = { ...c.girl, id: 'P', name: '甲', stamina: 80 }
  const save = { player: { gold: 0, reputation: 0 }, girls: [lead, p1], currentDay: 2, actionsUsedToday: 0, dailyGuests: [c.guest] } as unknown as import('./types').GameSave
  const res = applyPartners(resolveService({ girl: lead, guest: c.guest, outfit: c.outfit, stockings: c.stockings, roomLevel: 2, skip: true }), { girl: lead, guest: c.guest, partners: [p1] })
  const { save: next } = applyServiceToSave(save, 'L', c.guest, res, () => 0.99)
  assert.equal(next.actionsUsedToday, 1)
  const P = next.girls.find((g) => g.id === 'P')!
  assert.equal(P.stamina, 80 - res.partnerStamina!.P)
  assert.ok(JSON.stringify(P.memory).includes(c.guest.name))
  assert.deepEqual([...(next.appearedToday ?? [])].sort(), ['L', 'P'])
  assert.equal(next.player.gold, res.reward)
})

test('多人亲自上场：兴奋/快感按每位协同各自记', () => {
  const c = CASES[1]
  const p1 = { ...c.girl, id: 'p1', name: '甲' }
  const s = initLiveState({ girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, roomLevel: 2, partners: [p1] })
  assert.deepEqual(Object.keys(s.heat!.girls).sort(), [c.girl.id, 'p1'].sort())
  assert.ok(heatPromptBlock(s.heat!, c.guest.name, [c.girl, p1]).includes('甲'))
})

import { transitionTurn, transitionFallback, trimHistory } from './prompt-context'

test('自动转场：指令带新一步做法、人物、档位；本地兜底是一句叙述；前情不收转场指令', () => {
  const t = { from: '挑逗', to: '前戏', action: '用乳汁润滑后慢慢揉弄。', girls: ['千雪', '娜露梅亚'], guest: '王老板', heatLine: '王老板动摇、千雪从容' }
  const turn = transitionTurn(t)
  assert.ok(turn.includes('「前戏」') && turn.includes('用乳汁润滑') && turn.includes('千雪、娜露梅亚') && turn.includes('王老板动摇'))
  const fb = transitionFallback(t)
  assert.ok(fb.includes('千雪和娜露梅亚') && fb.includes('「前戏」开始了') && !fb.includes('。。'))
  const msgs = Array.from({ length: 8 }, (_, i) => [
    { role: 'user' as const, content: i === 2 ? '（转场：xx）' : `第${i}句玩家话`, ...(i === 2 ? { hidden: true } : {}) },
    { role: 'assistant' as const, content: '好' },
  ]).flat()
  const out = trimHistory(msgs, 3)
  assert.ok(!out[0].content.includes('转场'))
})
