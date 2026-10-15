import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { fxGirl, fxPlayer, fxGuest } from './prompt-fixtures'
import {
  emptyMemory, addEvent, markFirst, recordTraining, recordService, recordGift, giftAffection, recordQuote, removeQuote, removeEvent,
  regularBonus, syncMemory, compactMemory, localSummary, girlMemoryBlock, needsAiSummary, buildGirlSummaryPrompt, parseSummary,
  generateMemorySummaries, applyMemorySummaries, backfillMemory, memOf, MAX_EVENTS, MAX_QUOTES, PROMPT_BLOCK_MAX, SUMMARY_MAX,
} from './girl-memory'
import { resolveTraining } from './resolve-training'
import { resolveService } from './resolve-service'
import { applyServiceToSave, applyTrainingToSave } from './settle-session'
import { endDay, giveGift } from './hub-logic'
import { migrateSave, SAVE_VERSION } from './migrate-save'
import { buildServiceSystemPrompt, buildInteractionSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'

const g0 = (o: Partial<MonstGirl> = {}) => fxGirl({ race: '人类', memory: emptyMemory(), ...o })
const mkSave = (girls: MonstGirl[], o: Partial<GameSave> = {}): GameSave =>
  ({ player: { ...fxPlayer, gold: 5000, ownedScenes: ['tentacle', 'hypnosis'] }, girls, currentDay: 5, phase: 'morning', actionsUsedToday: 0, dailyGuests: [], regulars: [], ...o })

test('容量：最多 40 条，先淘汰分量轻、再淘汰旧的；文字截断', () => {
  let g = g0()
  g = addEvent(g, { day: 1, kind: 'first', text: '永久', w: 3 })
  for (let i = 0; i < 60; i++) g = addEvent(g, { day: 2 + i, kind: 'service', text: `事${i}`.repeat(i === 0 ? 30 : 1), w: i % 5 === 0 ? 2 : 1 })
  const ev = memOf(g).events
  assert.equal(ev.length, MAX_EVENTS)
  assert.ok(ev.some((e) => e.text === '永久'))
  assert.ok(ev.filter((e) => e.w === 2).length === 12)
  assert.ok(ev.every((e) => e.text.length <= 40))
})

test('第一次只记一次；遗忘：普通 14 天、重要 30 天，永久不忘；当天有事才重写本地心里话', () => {
  let g = markFirst(g0(), 'service', 1, '第1天第一次接客')
  g = markFirst(g, 'service', 3, '重复')
  assert.equal(memOf(g).events.length, 1)
  g = addEvent(g, { day: 2, kind: 'training', text: '普通', w: 1 })
  g = addEvent(g, { day: 2, kind: 'gift', text: '礼物', w: 2 })
  g = addEvent(g, { day: 20, kind: 'training', text: '今天', w: 1 })
  const c = compactMemory(g, 20)
  assert.deepEqual(memOf(c).events.map((e) => e.text), ['第1天第一次接客', '礼物', '今天'])
  assert.ok(memOf(c).summary.length > 0 && memOf(c).summaryDay === 20)
  const c2 = compactMemory(c, 40)
  assert.deepEqual(memOf(c2).events.map((e) => e.text), ['第1天第一次接客'])
  assert.equal(memOf(c2).summary, memOf(c).summary) // 当天没事：保留旧心里话
  assert.ok(localSummary(c).length <= SUMMARY_MAX)
})

test('调教记忆：普通 / 第一次进场景 / 觉醒 / 催眠模糊 / 惩罚', () => {
  const g = g0({ race: '史莱姆', lewdness: 60, sceneState: { tentacle: { uses: [], fp: 6, sp: 0 } } })
  const r = resolveTraining({ girl: g, direction: 'release', skip: true, scene: 'tentacle', day: 5 })
  assert.equal(r.awakenedScene, 'tentacle')
  const after = recordTraining(r.girl, g, r, 5)
  const texts = memOf(after).events.map((e) => `${e.kind}:${e.text}`)
  assert.ok(texts.some((t) => t.startsWith('training:触手房·放权')))
  assert.ok(texts.includes('first:第5天第一次被带进触手房'))
  assert.ok(texts.includes('awaken:第5天在触手房里觉醒了触手癖'))
  const h = resolveTraining({ girl: g0(), direction: 'tame', skip: true, scene: 'hypnosis', day: 5 })
  assert.ok(memOf(recordTraining(h.girl, g0(), h, 5)).events.some((e) => e.text.includes('记忆模糊')))
  const bad = g0({ incident: { kind: '闯祸', text: '打碎了客人的酒杯', day: 4 } })
  const p = resolveTraining({ girl: bad, direction: 'punish', skip: true, day: 5 })
  assert.ok(memOf(recordTraining(p.girl, bad, p, 5)).events.some((e) => e.kind === 'punish' && e.text.includes('打碎了客人的酒杯')))
})

test('接客记忆 + 熟客：接过 3 次且最好 ≥70 → 迎客 +2', () => {
  const guest = fxGuest({ id: 'gx', prefRace: undefined, prefTrait: undefined, prefOutfit: null })
  let g = g0()
  g = recordService(g, guest, { tier: '一般', sat: 50, reward: 100 }, 1)
  g = recordService(g, guest, { tier: '满意', sat: 75, reward: 100 }, 2)
  assert.equal(regularBonus(g, guest), 0)
  g = recordService(g, guest, { tier: '一般', sat: 40, reward: 100 }, 3)
  assert.equal(regularBonus(g, guest), 2)
  assert.deepEqual(memOf(g).guestTally.gx, { name: '王老板', count: 3, bestSat: 75 })
  const a = resolveService({ girl: g0(), guest, skip: true }), b = resolveService({ girl: g, guest, skip: true })
  assert.equal(b.steps[0].score - a.steps[0].score, 2)
  // 写档路径
  const s = mkSave([g0({ id: 'z' })])
  const n = applyServiceToSave(s, 'z', guest, a, () => 0.99).save
  assert.ok(memOf(n.girls[0]).firsts.includes('service'))
})

test('送礼：第一次这档 +2，三天内同档七成；写进记忆', () => {
  const s = mkSave([g0({ id: 'a', affection: 10 })])
  const r = giveGift(s, 'a', 1); assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.save.girls[0].affection, 27)
  assert.ok(memOf(r.save.girls[0]).events.some((e) => e.kind === 'gift'))
  const g = r.save.girls[0]
  assert.equal(giftAffection(g, 1, 15, 7).value, 11)
  assert.equal(giftAffection(g, 1, 15, 9).value, 15)
  assert.equal(giftAffection(g, 2, 30, 6).value, 32)
  assert.ok(recordGift(g, 1, '精美首饰', 6))
})

test('让她记住：去重、最多 5 句、可删；亲自上场中记的话结算后不丢', () => {
  let g = g0()
  for (let i = 0; i < 7; i++) g = recordQuote(g, `第${i}句话`, 3)
  g = recordQuote(g, '第6句话', 3)
  assert.equal(memOf(g).quotes.length, MAX_QUOTES)
  assert.equal(memOf(g).quotes[0].text, '第2句话')
  g = removeQuote(g, '第6句话')
  assert.equal(memOf(g).quotes.length, 4)
  assert.ok(!memOf(g).events.some((e) => e.text.includes('第6句话')))
  assert.equal(memOf(removeEvent(g, 0)).events.length, memOf(g).events.length - 1)
  // 调教场景里点了「让她记住」，再结算
  const girl = g0({ id: 'q' })
  const r = resolveTraining({ girl, direction: 'tame', skip: false, day: 5 })
  const s = mkSave([recordQuote(girl, '你是我的', 5)])
  const n = applyTrainingToSave(s, r)
  assert.equal(memOf(n.girls[0]).quotes[0].text, '你是我的')
  assert.ok(memOf(n.girls[0]).firsts.includes('training'))
})

test('syncMemory：入馆、里程碑只记一次、新事件', () => {
  const a = g0({ id: 'a', affection: 68 })
  const prev = mkSave([a])
  const arrived = syncMemory(prev, mkSave([a, g0({ id: 'b', name: '新人' })]))
  assert.ok(memOf(arrived.girls[1]).events.some((e) => e.kind === 'arrival' && e.text.includes('千雪来迎接')))
  const up = syncMemory(prev, mkSave([{ ...a, affection: 72, incident: { kind: '闯祸', text: '偷吃点心', day: 5 } }]))
  const ev = memOf(up.girls[0]).events
  assert.ok(ev.some((e) => e.kind === 'milestone' && e.text.startsWith('好感到了70')))
  assert.ok(ev.some((e) => e.kind === 'incident' && e.text === '偷吃点心'))
  const again = syncMemory({ ...up, girls: [{ ...up.girls[0], affection: 60 }] }, { ...up, girls: [{ ...up.girls[0], affection: 75 }] })
  assert.equal(memOf(again.girls[0]).events.filter((e) => e.kind === 'milestone').length, 1)
  const same = mkSave([a]); assert.equal(syncMemory(same, same), same)
})

test('提示词：无记忆时逐字不变；有记忆时注入且不超长、按场合挑事', () => {
  const sess = (g: MonstGirl) => createServiceSession('training', [g], {})
  const noMem = fxGirl({ race: '人类' })
  const empty = g0()
  assert.equal(buildServiceSystemPrompt(fxPlayer, sess(noMem)), buildServiceSystemPrompt(fxPlayer, sess(empty)))
  assert.equal(buildInteractionSystemPrompt(fxPlayer, noMem, 'chat'), buildInteractionSystemPrompt(fxPlayer, empty, 'chat'))
  assert.equal(girlMemoryBlock(empty, { type: 'hub' }), '')
  let g = g0()
  for (let i = 0; i < 30; i++) g = addEvent(g, { day: i, kind: 'service', text: '接待了一个很长很长很长很长很长很长很长的客人名字', w: 1 })
  g = addEvent(g, { day: 3, kind: 'training', text: '触手房·驯服', w: 1, scene: 'tentacle' })
  g = recordQuote(g, '你是最棒的', 4)
  g = { ...g, memory: { ...memOf(g), summary: '心'.repeat(150) } }
  const blk = girlMemoryBlock(g, { type: 'training', scene: 'tentacle' })
  assert.ok(blk.includes('触手房·驯服') && blk.includes('「你是最棒的」'))
  assert.ok(blk.length <= PROMPT_BLOCK_MAX + 40)
  const sp = buildServiceSystemPrompt(fxPlayer, sess(g), 'standard', undefined, { scene: 'tentacle' })
  assert.ok(sp.includes('千雪的记忆'))
})

test('AI 心里话：每人一次、坏 JSON/失败保留本地、成功替换并记 aiDay', async () => {
  const yesterday = (id: string) => addEvent(g0({ id, name: id }), { day: 4, kind: 'training', text: '昨天的事', w: 1 })
  const s = mkSave([yesterday('ok'), yesterday('bad'), yesterday('boom'), g0({ id: 'idle', name: 'idle' })])
  assert.deepEqual(s.girls.map((g) => needsAiSummary(g, 5)), [true, true, true, false])
  const p = buildGirlSummaryPrompt(s.girls[0], fxPlayer, '自称：咱', '')
  assert.ok(p.includes('昨天的事') && p.includes('自称：咱') && p.includes('{"summary"'))
  const calls: string[] = []
  const fakeFetch = async (prompt: string) => {
    const who = s.girls.find((g) => prompt.includes(`魔物娘${g.name}`))!.name
    calls.push(who)
    if (who === 'boom') throw new Error('fetch failed')
    if (who === 'bad') return '不是 JSON'
    return '好的：{"summary":"馆主今天摸了咱的头，咱有点开心。"}'
  }
  const prompts = Object.fromEntries(s.girls.map((g) => [g.id, buildGirlSummaryPrompt(g, fxPlayer, '', '')]))
  const res = await generateMemorySummaries(s, prompts, fakeFetch)
  assert.deepEqual(calls, ['ok', 'bad', 'boom'])
  assert.deepEqual(res, { ok: '馆主今天摸了咱的头，咱有点开心。' })
  const n = applyMemorySummaries(s, 5, ['ok', 'bad', 'boom'], res)
  assert.equal(memOf(n.girls[0]).summary, '馆主今天摸了咱的头，咱有点开心。')
  assert.equal(memOf(n.girls[1]).summary, '')
  assert.ok(n.girls.slice(0, 3).every((g) => g.memory?.aiDay === 5))
  assert.equal(needsAiSummary(n.girls[0], 5), false)
  assert.equal(applyMemorySummaries(s, 4, ['ok'], res), s) // 过期的回包不写
  assert.equal(parseSummary('{"summary":"<b>坏</b>"}'), 'b坏/b')
  assert.equal(parseSummary('{"summary":""}'), null)
})

test('结束今天：压缩记忆并写本地心里话；挂机写进记忆', () => {
  let g = addEvent(g0({ id: 'm' }), { day: 5, kind: 'training', text: '今天被调教了', w: 1 })
  const s = mkSave([g], { machineNightGirlId: undefined })
  const n = endDay(s, () => 0.99)
  assert.ok(memOf(n.girls[0]).summary.includes('今天被调教了'))
  g = g0({ id: 'm2' })
  const s2 = mkSave([g], { machineNightGirlId: 'm2' }); s2.player.ownedScenes = ['machine']
  assert.ok(memOf(endDay(s2, () => 0.99).girls[0]).events.some((e) => e.text.includes('机械调教室')))
})

test('迁移 v2：从回头客记忆/事件回填，幂等；容量估算', () => {
  assert.equal(SAVE_VERSION, 4)
  const old = { player: { ...fxPlayer }, currentDay: 9, phase: 'morning',
    girls: [{ ...fxGirl({ id: 'x' }), memory: undefined, incident: { kind: '闯祸', text: '迟到了', day: 8 } }],
    regulars: [fxGuest({ id: 'r1', name: '老李', satisfaction: 80, memories: { 千雪: { guestAboutGirl: '好', girlAboutGuest: '老李很温柔', visitCount: 2 } } })] } as unknown as GameSave
  const m = migrateSave(old)
  const mem = memOf(m.girls[0])
  assert.ok(mem.events.some((e) => e.text.includes('老李很温柔')) && mem.events.some((e) => e.text === '迟到了'))
  assert.deepEqual(mem.guestTally.r1, { name: '老李', count: 2, bestSat: 80 })
  assert.ok(mem.summary.length > 0)
  assert.deepEqual(migrateSave(m).girls[0].memory, m.girls[0].memory)
  const blank = backfillMemory(fxGirl({ memory: undefined }), [], 3)
  assert.deepEqual(blank.memory, emptyMemory())
  // 20 人满记忆的大小
  let full = g0()
  for (let i = 0; i < 60; i++) full = addEvent(full, { day: i, kind: 'service', text: '接'.repeat(40), w: 1, guestId: 'guest-' + i })
  for (let i = 0; i < 5; i++) full = recordQuote(full, '话'.repeat(30) + i, 1)
  full = { ...full, memory: { ...memOf(full), summary: '心'.repeat(200) } }
  const bytes = new TextEncoder().encode(JSON.stringify(Array.from({ length: 20 }, () => full.memory))).length
  assert.ok(bytes < 200_000, `${bytes}`)
})
