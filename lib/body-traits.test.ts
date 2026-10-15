import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { fxPlayer, fxGirl, fxGuest } from './prompt-fixtures'
import { migrateSave } from './migrate-save'
import {
  bodyTraitsOf, bodyTraitLabel, hasBodyTrait, grantBodyTrait, cureBodyTraits, expireBodyTraits, awakenBodyTraits, bodyTraitCraft,
  bodyTraitLine, traitPlayAvailable, TRAIT_PLAYS, BODY_TRAITS, BODY_GREET_BONUS,
} from './body-traits'
import { buyBodyPotion, useBodyPotion, buyAntidote, useAntidote, potionInvId } from './shop'
import { endDay } from './hub-logic'
import { getAvailablePlays, scorePlay, resolveService } from './resolve-service'
import { parseGuestBias, biasGuest } from './guest-gen'
import { guestPrefChecks } from './guest-prefs'
import { guestPrefLine } from './prompt-context'
import { buildServiceSystemPrompt } from './prompt-builder'
import { createServiceSession } from './game-engine'
import { STORE_THEMES } from './store-theme'
import { cheatGrantTrait, cheatRemoveTrait } from './cheat'
import { PLAY_CRAFT } from './play-prompts'

const cow = () => fxGirl({ id: 'cow', name: '千雪', race: '牛娘', bust: 108 })
const base = (girls = [fxGirl(), cow()]): GameSave => migrateSave({ player: { ...fxPlayer, gold: 2000 }, girls, currentDay: 5, phase: 'morning', actionsUsedToday: 0, dailyGuests: [], regulars: [] } as GameSave)

test('体质：天生按种族（牛娘泌乳 / 魔女淫纹 / 史莱姆媚药体质），永久', () => {
  assert.deepEqual(bodyTraitsOf(cow()).map((t) => t.id), ['lactation'])
  assert.ok(hasBodyTrait(fxGirl({ race: '魔女' }), 'crest'))
  assert.ok(hasBodyTrait(fxGirl({ race: '史莱姆' }), 'aphro'))
  assert.equal(bodyTraitsOf(fxGirl()).length, 0)
  assert.equal(bodyTraitLabel(bodyTraitsOf(cow())[0]), '泌乳（天生）')
})

test('改造药剂：买进背包 → 给她喝 → 药效 N 天，卡上显示剩余天数，到期自动消失并写进小结', () => {
  let s = base()
  const b = buyBodyPotion(s, 'sensitive'); assert.ok(b.ok); s = (b as { save: GameSave }).save
  assert.equal(s.player.inventory?.[potionInvId('sensitive')], 1)
  const u = useBodyPotion(s, 'qx', 'sensitive'); assert.ok(u.ok, (u as { error?: string }).error); s = (u as { save: GameSave }).save
  assert.equal(s.player.inventory?.[potionInvId('sensitive')], undefined)
  const qx = () => s.girls.find((g) => g.id === 'qx')!
  assert.equal(bodyTraitLabel(bodyTraitsOf(qx(), s.currentDay)[0]), '敏感体质（药效余 3 天）')
  s = endDay(s); assert.equal(bodyTraitsOf(qx(), s.currentDay)[0].daysLeft, 2)
  s = endDay(s); s = endDay(s)
  assert.equal(s.currentDay, 8)
  assert.equal(bodyTraitsOf(qx(), s.currentDay).length, 0)
  assert.match(s.lastDaySummary?.bodyTraits ?? '', /敏感体质药效过了/)
})

test('改造药剂：天生的不能再喝；同一项再喝取更晚的到期日', () => {
  let s = base()
  s = (buyBodyPotion(s, 'lactation') as { save: GameSave }).save
  assert.ok(!useBodyPotion(s, 'cow', 'lactation').ok)
  const g = grantBodyTrait(grantBodyTrait(fxGirl(), 'estrus', 'potion', 5), 'estrus', 'potion', 6)
  assert.equal(g.bodyTraits?.[0].expiresDay, 8)
})

test('解药：解除全部药剂体质，天生 / 觉醒不受影响；没有药剂体质时报错', () => {
  let s = base()
  s = (buyAntidote(s) as { save: GameSave }).save
  assert.ok(!useAntidote(s, 'cow').ok)
  s = { ...s, girls: s.girls.map((g) => g.id === 'cow' ? grantBodyTrait(grantBodyTrait(g, 'futa', 'potion', 5), 'estrus', 'awaken', 5) : g) }
  const r = useAntidote(s, 'cow'); assert.ok(r.ok); s = (r as { save: GameSave }).save
  assert.deepEqual(bodyTraitsOf(s.girls.find((g) => g.id === 'cow')!).map((t) => t.id).sort(), ['estrus', 'lactation'])
  assert.deepEqual(cureBodyTraits(fxGirl()).removed, [])
})

test('觉醒：淫乱 ≥90 → 发情期、四条敏感带 ≥75 → 敏感体质（永久，结束今天时）', () => {
  const g = fxGirl({ lewdness: 92, sensitivities: { 耳朵: 80, 阴蒂: 80, 唇舌: 76, 乳房: 90, 小穴: 40, 后庭: 15, 种族: 55 } })
  const r = awakenBodyTraits(g, 6)
  assert.deepEqual(r.awakened.sort(), ['estrus', 'sensitive'])
  assert.equal(bodyTraitsOf(r.girl).find((t) => t.id === 'estrus')?.source, 'awaken')
  assert.deepEqual(awakenBodyTraits(r.girl, 7).awakened, [])
  const s = endDay(base([g]))
  assert.match(s.lastDaySummary?.bodyTraits ?? '', /觉醒了/)
  assert.deepEqual(expireBodyTraits(r.girl, 99).expired, [])
})

test('体质 play：有体质才能选；魔女不重复给淫纹 play；客人偏好这项体质时算对口；都有写作素材', () => {
  const guest = fxGuest({ desires: '想要温柔的乳交与深喉服务' })
  assert.ok(getAvailablePlays(cow(), guest).some((p) => p.id === 'trait_nursing'))
  assert.ok(!getAvailablePlays(fxGirl(), guest).some((p) => p.source === 'trait'))
  const witch = fxGirl({ race: '魔女' })
  assert.ok(!traitPlayAvailable(TRAIT_PLAYS.find((p) => p.id === 'trait_crest_glow')!, witch))
  const futa = TRAIT_PLAYS.find((p) => p.id === 'trait_futa_reverse')!
  const g = grantBodyTrait(fxGirl(), 'futa', 'cheat', 5)
  const plain = fxGuest({ desires: '想把高傲的魔物娘彻底操服', desireKind: 'M' })
  assert.equal(scorePlay(g, plain, futa).matched, false)
  assert.equal(scorePlay(g, { ...plain, prefBody: 'futa' }, futa).matched, true)
  for (const p of TRAIT_PLAYS) assert.ok(PLAY_CRAFT[p.id], p.id)
})

test('结算：体质对上客人偏好，迎客 +4 并写进说明', () => {
  const guest = fxGuest({ prefRace: undefined, prefTrait: undefined, prefOutfit: null })
  const a = resolveService({ girl: cow(), guest, skip: true })
  const b = resolveService({ girl: cow(), guest: { ...guest, prefBody: 'lactation' }, skip: true })
  assert.equal(b.steps[0].score - a.steps[0].score, Math.min(BODY_GREET_BONUS, 14 - a.steps[0].score))
  assert.ok(b.raceNotes.some((n) => n.includes('体质「泌乳」')))
})

test('客人：定向换客人认体质词；喜好标签与提示词都带体质', () => {
  const parsed = parseGuestBias('喜欢泌乳、淫纹')
  assert.deepEqual(parsed.bodies, ['lactation', 'crest'])
  assert.ok(parsed.labels.includes('体质·泌乳'))
  const g = biasGuest(fxGuest(), parsed, () => 0.1)
  assert.ok(g.prefBody === 'lactation' || g.prefBody === 'crest')
  const guest = fxGuest({ prefBody: 'lactation' })
  assert.equal(guestPrefChecks(guest, [cow()]).find((c) => c.key === 'body')?.ok, true)
  assert.equal(guestPrefChecks(guest, [fxGirl()]).find((c) => c.key === 'body')?.ok, false)
  assert.match(guestPrefLine(guest, cow()), /体质：泌乳 ✔/)
})

test('提示词：角色卡带体质一行；写法按步骤给（迎客只写痕迹，正戏才写喷乳）', () => {
  const s = createServiceSession('service', [cow()], { guest: fxGuest() })
  assert.ok(buildServiceSystemPrompt(fxPlayer, s).includes('体质：泌乳（天生）'))
  assert.equal(bodyTraitLine(fxGirl()), '')
  assert.match(bodyTraitCraft(cow(), 0), /湿痕/)
  assert.match(bodyTraitCraft(cow(), 3), /喷出/)
  assert.ok(!bodyTraitCraft(cow(), 0).includes('喷'))
  assert.equal(BODY_TRAITS.every((t) => t.craft.length === 5), true)
})

test('店铺主题「体质改造馆」与作弊给/移体质', () => {
  const th = STORE_THEMES.find((t) => t.id === '体质')!
  assert.ok(th.fits(cow()) && !th.fits(fxGirl()))
  assert.ok(th.boost(fxGuest(), () => 0.1).prefBody)
  let s = cheatGrantTrait(base(), 'qx', 'bigbust')
  assert.equal(bodyTraitsOf(s.girls[0], 5)[0].source, 'cheat')
  s = cheatGrantTrait(s, 'qx', 'bigbust', 2)
  assert.equal(bodyTraitsOf(s.girls[0], 5)[0].daysLeft, 2)
  s = cheatRemoveTrait(s, 'qx', 'bigbust')
  assert.equal(bodyTraitsOf(s.girls[0], 5).length, 0)
  assert.ok(hasBodyTrait(cheatRemoveTrait(s, 'cow', 'lactation').girls[1], 'lactation'), '天生的移不掉')
})
