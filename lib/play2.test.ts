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
