import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sampleBank, availableWords, bankWordsUsed, denseStyleBlock, PROSE_BANK, DENSE_MIN_WORDS } from './prose-bank'
import { lengthReminder, shortReplyNote } from './prompt-context'
import { buildServiceSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { fxPlayer, fxGirl, fxGuest } from './prompt-fixtures'

test('词库：迎客/挑逗不给性器与体液，正戏才给撞击声；高潮类只在高潮档', () => {
  const early = { stepIndex: 0, climaxAllowed: false }
  assert.ok(!availableWords('part', early).includes('蜜穴'))
  assert.ok(!availableWords('fluid', early).includes('爱液'))
  assert.ok(!availableWords('sound', { stepIndex: 2, climaxAllowed: false }).includes('啪啪'))
  assert.ok(availableWords('sound', { stepIndex: 3, climaxAllowed: false }).includes('啪啪'))
  assert.ok(!availableWords('fluid', { stepIndex: 3, climaxAllowed: false }).includes('白浊'))
  assert.ok(availableWords('fluid', { stepIndex: 3, climaxAllowed: true }).includes('白浊'))
})

test('词库：每类按 pick 抽，同种子可复现，不同回合换一批，避开最近用过的', () => {
  const o = { stepIndex: 3, climaxAllowed: false, seed: 4 }
  const a = sampleBank(o), b = sampleBank(o), c = sampleBank({ ...o, seed: 6 })
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c)
  for (const [cat, def] of Object.entries(PROSE_BANK)) assert.equal(a[cat].length, def.pick)
  const avoid = a.touch
  const d = sampleBank({ ...o, avoid })
  assert.ok(d.touch.every((w) => !avoid.includes(w)))
})

test('bankWordsUsed：认出回复里的词库词，忽略数据块', () => {
  const used = bankWordsUsed('滚烫的乳沟里全是香汗，咕啾一声。<!-- STATS 白浊 -->')
  assert.ok(used.includes('滚烫') && used.includes('乳沟') && used.includes('香汗') && used.includes('咕啾'))
  assert.ok(!used.includes('白浊'))
})

test('重油：完整要求放在系统提示词最末尾，带密度要求与本回合词库；standard 不带', () => {
  const s = createServiceSession('service', [fxGirl()], { guest: fxGuest() })
  const dense = buildServiceSystemPrompt(fxPlayer, s, 'dense', '【这一步】ctx', { dense: { stepIndex: 1, climaxAllowed: false, seed: 1 } })
  const tail = dense.slice(dense.lastIndexOf('【★重油文风'))
  assert.ok(dense.lastIndexOf('【★重油文风') > dense.indexOf('【这一步】ctx'))
  assert.ok(tail.includes('【本回合词库') && tail.includes(`${DENSE_MIN_WORDS} 个不同的词`) && tail.includes('3–4 个修饰'))
  assert.ok(!tail.includes('蜜穴'))
  assert.ok(tail.includes('本回合没有人到高潮') && tail.includes('「挑逗」这一步') && tail.includes('最多 1200 字'))
  assert.ok(denseStyleBlock({ stepIndex: 3, climaxAllowed: true, seed: 1 }).includes('本回合有人到了高潮档'))
  assert.ok(!buildServiceSystemPrompt(fxPlayer, s, 'standard').includes('【★重油文风'))
  // 与去油禁令第 3 条不冲突
  assert.ok(dense.includes('词库词是描写素材'))
  assert.equal(denseStyleBlock({ stepIndex: 3, climaxAllowed: false, seed: 2, avoid: ['软糯'] }).includes('前几段已经用过（这段换别的说法）：软糯'), true)
})

test('重油：每回合提醒与偏短提醒按 800–1200 字', () => {
  assert.ok(lengthReminder('service', 'dense').includes('正文 800–1200 字'))
  assert.ok(lengthReminder('training', 'dense').includes('重油'))
  assert.ok(lengthReminder('service').includes('正文 300–500 字') && !lengthReminder('service').includes('重油'))
  assert.ok(!lengthReminder('chat', 'dense').includes('重油'))
  const r = '字'.repeat(420)
  assert.equal(shortReplyNote(r), '')
  assert.ok(shortReplyNote(r, 'dense').includes('800–1200'))
  assert.ok(shortReplyNote('字'.repeat(700), 'dense').includes('偏短') && shortReplyNote('字'.repeat(900), 'dense') === '')
})
