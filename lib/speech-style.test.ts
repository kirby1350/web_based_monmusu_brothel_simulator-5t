import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GIRL_TEMPLATES, GIRL_TEMPLATE_IMAGES, GIRL_TEMPLATE_TAGLINES, RACES } from './game-data'
import { SPEECH_RULE, speechBrief, speechLine, speechRuleFor, speechRows } from './speech-style'
import { buildServiceSystemPrompt, buildInteractionSystemPrompt, buildOpeningDialoguePrompt, buildMemoryPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { fxGirl, fxGuest, fxPlayer } from './prompt-fixtures'

test('口癖：每个预设都有 自称/称呼/语气/招牌台词 四行，且至少三句招牌台词', () => {
  for (const t of GIRL_TEMPLATES) {
    assert.ok(t.speechStyle, t.name)
    const rows = speechRows(t.speechStyle)
    assert.deepEqual(rows.map(([k]) => k), ['自称', '称呼', '语气', '招牌台词'], t.name)
    assert.ok((rows[3][1].match(/「[^」]+」/g) ?? []).length >= 3, t.name)
  }
})

test('预设：全员成年，新角色与种族对应，图片/简介数组与模板等长', () => {
  for (const t of GIRL_TEMPLATES) {
    const n = parseInt(t.age, 10)
    assert.ok(Number.isFinite(n) && n >= 18, `${t.name} age ${t.age}`)
    assert.ok(RACES.some((r) => r.name === t.race), `${t.name} race ${t.race}`)
    assert.ok(/mature female|adult/.test(`${t.bodyTags}, ${t.imageTags}, ${t.otherTags}`), `${t.name} adult tag`)
    assert.ok(!/high school|school uniform|高中|女高中生|\bteen\b|\bloli\b/i.test(`${t.bodyTags} ${t.imageTags} ${t.otherTags} ${t.otherDesc}`), t.name)
  }
  const want: Record<string, string> = { 柴郡: '猫娘', 爱宕: '犬娘', 赤城: '狐娘', 大凤: '哈比' }
  for (const [name, race] of Object.entries(want)) {
    assert.equal(GIRL_TEMPLATES.find((t) => t.name === name)?.race, race, name)
  }
  assert.equal(GIRL_TEMPLATE_IMAGES.length, GIRL_TEMPLATES.length)
  assert.equal(GIRL_TEMPLATE_TAGLINES.length, GIRL_TEMPLATES.length)
  assert.equal(GIRL_TEMPLATES.find((t) => t.name === '志希')?.age, '18')
})

test('口癖辅助函数：折行、带前缀、空值', () => {
  const s = '自称：我\n称呼：馆主\n语气：轻柔\n招牌台词：「a」「b」「c」'
  assert.equal(speechBrief({ speechStyle: s }), '自称：我；称呼：馆主；语气：轻柔；招牌台词：「a」「b」「c」')
  assert.equal(speechLine({ speechStyle: s }, '\n  '), '\n  口癖：自称：我；称呼：馆主；语气：轻柔；招牌台词：「a」「b」「c」')
  assert.equal(speechLine({}), '')
  assert.equal(speechLine({ speechStyle: '  ' }), '')
  assert.equal(speechRuleFor([{}]), '')
  assert.equal(speechRuleFor([{}, { speechStyle: s }]), `\n${SPEECH_RULE}`)
  assert.deepEqual(speechRows('自由描述一行'), [['', '自由描述一行']])
})

const withSpeech = () => fxGirl({ speechStyle: GIRL_TEMPLATES[0].speechStyle })

test('口癖进入服务/调教系统提示词（含使用规则），无口癖时不出现', () => {
  for (const mode of ['service', 'training'] as const) {
    const p = buildServiceSystemPrompt(fxPlayer, createServiceSession(mode, [withSpeech()], mode === 'service' ? { guest: fxGuest() } : {}), 'standard', undefined, { day: 6 })
    assert.ok(p.includes('口癖：自称：我'), mode)
    assert.ok(p.includes(SPEECH_RULE), mode)
    const q = buildServiceSystemPrompt(fxPlayer, createServiceSession(mode, [fxGirl()], mode === 'service' ? { guest: fxGuest() } : {}), 'standard', undefined, { day: 6 })
    assert.ok(!q.includes('口癖') && !q.includes(SPEECH_RULE), mode)
  }
})

test('口癖进入互动系统提示词、开场白与记忆提示词', () => {
  const g = withSpeech()
  const ip = buildInteractionSystemPrompt(fxPlayer, g, 'chat')
  assert.ok(ip.includes('口癖：') && ip.includes(SPEECH_RULE))
  for (const scene of ['service', 'training', 'interaction', 'purchase'] as const) {
    const op = buildOpeningDialoguePrompt(scene, fxPlayer, [g], { girl: g, guest: fxGuest(), currentDay: 6 })
    assert.ok(op.includes('口癖：'), scene)
  }
  const mp = buildMemoryPrompt(fxGuest(), g, '客人点了一壶茶，两人聊了很久')
  assert.ok(mp.includes('口癖：'))
})

test('两位病娇区分：赤城谋划清除情敌，大凤撒娇求宠、独占', () => {
  const akagi = GIRL_TEMPLATES.find((t) => t.name === '赤城')!
  const taihou = GIRL_TEMPLATES.find((t) => t.name === '大凤')!
  assert.ok(/scheming/.test(akagi.personalityTags) && !/wants to be pampered/.test(akagi.personalityTags))
  assert.ok(/wants to be pampered/.test(taihou.personalityTags) && /monopolizing/.test(taihou.personalityTags) && !/scheming/.test(taihou.personalityTags))
  assert.ok(!GIRL_TEMPLATES.some((t) => t.name === '出云'))
  assert.notEqual(speechRows(akagi.speechStyle)[0][1], speechRows(taihou.speechStyle)[0][1])
})
