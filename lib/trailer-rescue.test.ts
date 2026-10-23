import test from 'node:test'
import assert from 'node:assert/strict'
import { needsTrailerRescue, mergeTrailer, rescueTrailer, buildTrailerRescueMessages, DEFAULT_ACTIONS } from './trailer-rescue'
import { parseStatsFromReply, parseActionsFromReply, stripStatsBlock } from './game-engine'

const body = '千雪跪下来。\n\n「齁哦——❤」'
const S = '<!--STATS:{"girls":{"千雪":{"pleasure":12,"stamina":-6}},"satisfaction":8}-->'
const A = '<!--ACTIONS:["深喉","骑上去","抓住尾巴"]-->'

test('补救：完整回复不触发，缺块/坏块/空回复的判定', () => {
  assert.equal(needsTrailerRescue(`${body}\n${S}\n${A}`), false)
  assert.equal(needsTrailerRescue(body), true)
  assert.equal(needsTrailerRescue(`${body}\n${S}`), true)
  assert.equal(needsTrailerRescue(`${body}\n<!--STATS:乱写-->\n${A}`), true)
  assert.equal(needsTrailerRescue(''), false)
})

test('补救：请求只带正文并列出每个姑娘', () => {
  const m = buildTrailerRescueMessages(`${body}\n${A}`, ['千雪', '露'])
  assert.equal(m.length, 1); assert.equal(m[0].role, 'user')
  assert.ok(m[0].content.includes('"千雪"') && m[0].content.includes('"露"') && m[0].content.includes('齁哦') && !m[0].content.includes('骑上去'))
})

test('补救：并入补到的两行，正文不变', () => {
  const r = mergeTrailer(body, `好的\n${S}\n${A}`, ['千雪'])
  assert.equal(r.source, 'rescued')
  assert.equal(parseStatsFromReply(r.text)!.girls['千雪'].pleasureDelta, 12)
  assert.deepEqual(parseActionsFromReply(r.text), ['深喉', '骑上去', '抓住尾巴'])
  assert.equal(stripStatsBlock(r.text), body)
})

test('补救：只缺 ACTIONS 时保留原 STATS；坏 STATS 被替换', () => {
  const r = mergeTrailer(`${body}\n${S}`, `<!--STATS:{"satisfaction":20}-->\n${A}`, ['千雪'])
  assert.equal(r.source, 'rescued'); assert.equal(parseStatsFromReply(r.text)!.satisfactionDelta, 8)
  const bad = mergeTrailer(`${body}\n<!--STATS:乱写-->\n${A}`, S, ['千雪'])
  assert.equal(parseStatsFromReply(bad.text)!.satisfactionDelta, 8); assert.equal(stripStatsBlock(bad.text), body)
})

test('补救失败：默认不改数值、默认行动；部分成功标 partial', async () => {
  for (const ask of [async () => { throw new Error('offline') }, async () => '', async () => '我不知道']) {
    const r = await rescueTrailer(body, ['千雪'], ask)
    assert.equal(r.source, 'default')
    const st = parseStatsFromReply(r.text)!
    assert.equal(st.girls['千雪'].pleasureDelta, 0); assert.equal(st.satisfactionDelta, 0); assert.equal(st.girls['千雪'].staminaDelta, -2)
    assert.deepEqual(parseActionsFromReply(r.text), DEFAULT_ACTIONS)
    assert.equal(stripStatsBlock(r.text), body)
  }
  assert.equal((await rescueTrailer(body, ['千雪'], async () => A)).source, 'partial')
  let called = 0
  assert.equal((await rescueTrailer(`${body}\n${S}\n${A}`, ['千雪'], async () => { called++; return '' })).source, 'none')
  assert.equal(called, 0)
})
