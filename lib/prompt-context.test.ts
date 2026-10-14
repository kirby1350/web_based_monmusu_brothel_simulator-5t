import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ChatMessage } from './types'
import { girlStateCard, guestPrefLine, trimHistory, contextImageTags, trainingContext, houseStateLines, VALID_RACES, buildStepRecap, hubOpeningPrompt } from './prompt-context'
import { buildServiceSummary, serviceDetailLine } from './resolve-service'
import { buildServiceSystemPrompt, buildSuggestionPrompt } from './prompt-builder'
import { createServiceSession, parseStatsFromReply } from './game-engine'
import { fxGirl, fxGuest, fxPlayer } from './prompt-fixtures'

test('1. 状态卡：技能档、倾向进度、种族被动、敏感带、事件、天数', () => {
  const card = girlStateCard(fxGirl({ incident: { kind: '闯祸', text: '偷吃了点心', day: 5 } }), 6)
  for (const s of ['待客 熟练', '口侍 初学', 'M3/S0', '魅惑', '耳朵 弱点', '事件：闯祸·偷吃了点心', '第6天', '招牌：低语诱惑']) assert.ok(card.includes(s), s)
  assert.ok(card.length < 160, `card ${card.length}`)
  assert.ok(girlStateCard(fxGirl({ skillRanks: {} })).includes('技能：尚未学会'))
})

test('1. 服务系统提示词用状态卡替代旧技能行', () => {
  const session = createServiceSession('service', [fxGirl()], { guest: fxGuest() })
  const p = buildServiceSystemPrompt(fxPlayer, session, 'standard', undefined, { day: 6 })
  assert.ok(p.includes('状态：技能：待客 熟练'))
  assert.ok(!/\n  技能：/.test(p))
})

test('3. 客人偏好命中：种族/特征/服装（含丝袜）', () => {
  const line = guestPrefLine(fxGuest(), fxGirl(), 'regular', 'black')
  assert.ok(line.includes('种族：狐娘 ✔') && line.includes('特征：巨乳 ✔') && line.includes('服装：黑丝 ✔（已换上黑丝）'))
  const miss = guestPrefLine(fxGuest({ prefRace: '龙娘', prefTrait: '贫乳', prefOutfit: '制服' }), fxGirl())
  assert.equal((miss.match(/✘/g) ?? []).length, 3)
  assert.equal(guestPrefLine(fxGuest({ prefRace: undefined, prefTrait: undefined, prefOutfit: null }), fxGirl()), '')
  const p = buildServiceSystemPrompt(fxPlayer, createServiceSession('service', [fxGirl()], { guest: fxGuest() }), 'standard', undefined, { stockings: 'black' })
  assert.ok(p.includes('【客人偏好】'))
})

const reply = (n: number) => `第${n}段叙述。\n<!--STATS:{"girls":{"千雪":{"pleasure":5,"stamina":-4}},"satisfaction":${n}}-->\n<!--ACTIONS:["a","b","c"]-->`
const convo = (turns: number): ChatMessage[] => Array.from({ length: turns }, (_, i) => [
  { role: 'user' as const, content: `玩家行动${i + 1}` }, { role: 'assistant' as const, content: reply(i + 1) }]).flat()

test('4. 历史裁剪：旧回复去数据块、最新一条保留、只留 6 轮 + 前情', () => {
  const out = trimHistory(convo(10))
  assert.equal(out.filter((m) => m.role === 'user').length, 7) // 前情 + 6 轮
  assert.ok(out[0].content.startsWith('【前情】已进行 4 轮'))
  const last = out[out.length - 1]
  assert.ok(last.content.includes('<!--STATS:'))
  assert.equal(parseStatsFromReply(last.content)?.satisfactionDelta, 10)
  assert.ok(out.slice(0, -1).every((m) => !m.content.includes('<!--')))
  // 末尾是用户新消息时，最新助手回复仍带数据块
  const withUser = trimHistory([...convo(3), { role: 'user', content: '继续' }])
  assert.equal(withUser.length, 7)
  assert.ok(withUser[5].content.includes('<!--STATS:') && !withUser[1].content.includes('<!--'))
})

test('4. 少于 6 轮不截断', () => {
  assert.equal(trimHistory(convo(6)).length, 12)
})

test('5. 服务摘要要点：满意度、服装命中、play、最强/最弱步骤', () => {
  const d = { satisfaction: 78, tierLabel: '满意', outfitName: '女仆装+黑丝', outfitMatched: true, plays: ['乳夹', '深喉'],
    steps: [{ label: '迎客', score: 10 }, { label: '正戏', score: 14 }, { label: '清洗', score: 4 }] }
  const line = serviceDetailLine('千雪', '王老板', d)
  assert.equal(line, '千雪×王老板：满意（78）｜女仆装+黑丝命中偏好｜play：乳夹、深喉｜正戏 14/14 最出彩，清洗 4/14 最弱')
  assert.ok(buildServiceSummary('千雪', '王老板', 'satisfied', 2, d).endsWith(line))
  assert.ok(!buildServiceSummary('千雪', '王老板', 'satisfied', 0).includes('｜'))
})

test('6. 图片标签：换装替换服装 tag、加状态 tag、质量词保底、≤40', () => {
  const t = contextImageTags(fxGirl(), { outfit: 'maid', stockings: 'black', exhausted: true }).split(', ')
  assert.ok(t.includes('maid outfit') && t.includes('black pantyhose') && t.includes('sweat'))
  assert.ok(!t.includes('miko') && !t.includes('red hakama'))
  assert.equal(t[t.length - 1], 'best quality')
  const many = fxGirl({ imageTags: Array.from({ length: 60 }, (_, i) => `tag${i}`).join(', ') + ', masterpiece' })
  const capped = contextImageTags(many, { exhausted: true }).split(', ')
  assert.equal(capped.length, 40); assert.equal(capped[39], 'masterpiece')
  assert.equal(contextImageTags(fxGirl()), fxGirl().imageTags)
})

test('2/7/8. 调教上下文、馆内近况、建议提示词与种族表', () => {
  const tc = trainingContext({ girl: fxGirl(), direction: 'drill', skill: '口侍', roomLevel: 2, props: ['mirror'], skip: true })
  assert.ok(tc.includes('特训') && tc.includes('口侍（初学 0/2）') && tc.includes('Lv2（×1.25）') && tc.includes('练习镜'))
  const hs = houseStateLines({ player: fxPlayer, girls: [fxGirl({ incident: { kind: '闯祸', text: '偷吃了点心', day: 5 } })], currentDay: 6, phase: 'morning' })
  assert.ok(hs.includes('千雪闯祸') && hs.includes('宿舍 Lv2'))
  const sp = buildSuggestionPrompt('service', reply(3), [], { step: '前戏', standardAction: '轻抚阴蒂', desires: '黑丝' })
  assert.ok(!sp.includes('<!--') && sp.includes('标准做法：轻抚阴蒂'))
  assert.ok(VALID_RACES.includes('猫娘') && VALID_RACES.includes('狐娘'))
})

test('1c. 步骤前情：分数/满分 + 关键动作，当前步骤进行中，≤2 行', () => {
  const steps = [
    { label: '迎客', score: 10, max: 14, turns: 2, key: '待客' },
    { label: '挑逗', score: 8, max: 14, turns: 1, key: '耳朵' },
    { label: '前戏', score: 0, max: 14, turns: 0, key: '阴蒂' },
    { label: '正戏', score: 0, max: 14, turns: 3, key: '身侍+乳夹' },
    { label: '清洗', score: 0, max: 14, turns: 0 },
  ]
  const r = buildStepRecap(steps, 3)
  assert.ok(r.startsWith('【前情】迎客 10/14·待客 → 挑逗 8/14·耳朵'))
  assert.ok(r.includes('前戏 0/14·阴蒂（跳过）') && r.includes('正戏 进行中（已写 3 回合）'))
  assert.ok(r.split('\n').length <= 2 && r.length < 120)
  // 传给 trimHistory 后替代默认前情
  const msgs: ChatMessage[] = Array.from({ length: 8 }, (_, i) => [{ role: 'user' as const, content: `u${i}` }, { role: 'assistant' as const, content: `a${i}` }]).flat()
  assert.equal(trimHistory(msgs, 6, r)[0].content, r)
})

test('1a. 大厅开场白：第 1 天或已缓存当天不请求，第 2 天起带馆内近况', async () => {
  const save = { player: fxPlayer, girls: [fxGirl({ incident: { kind: '闯祸' as const, text: '偷吃了点心', day: 5 } })], currentDay: 6, phase: 'morning' as const }
  assert.equal(await hubOpeningPrompt({ ...save, currentDay: 1 }, null), null)
  assert.equal(await hubOpeningPrompt(save, 6), null)
  const p = await hubOpeningPrompt(save, 5)
  assert.ok(p && p.includes('开业第 6 天') && p.includes('【馆内近况】') && p.includes('千雪闯祸'))
})
