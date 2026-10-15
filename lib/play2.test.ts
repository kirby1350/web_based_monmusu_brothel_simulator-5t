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
