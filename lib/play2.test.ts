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
