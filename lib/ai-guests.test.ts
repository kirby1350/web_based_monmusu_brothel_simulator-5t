import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest } from './types'
import { aiGuestPrompt, sanitizeAiGuest, parseAiGuest, applyAiGuests, generateAiGuests, shouldGenerateAiGuests } from './ai-guests'
import { createRandomGuest, GUEST_CLASSES } from './game-engine'
import { VALID_RACES } from './prompt-context'
import { fxGirl, fxPlayer, fxGuest } from './prompt-fixtures'

const noble = (): Guest => fxGuest({ id: 'n1', name: '甲', race: '贵族·人类', guestClass: 'noble', demand: 8, budget: 400, prefOutfit: '制服', desireKind: 'M', desireService: '口侍' })
const save = (guests: Guest[]): GameSave => ({ player: fxPlayer, girls: [fxGirl()], currentDay: 4, phase: 'morning', dailyGuests: guests })
const good = JSON.stringify({ name: '冯·雷德', race: '人类公爵', personality: '傲慢挑剔', traits: ['恋足', '支配'], desires: '要她跪着用舌头侍奉',
  prefRace: '龙娘', prefTrait: '贫乳', prefOutfit: '和服', imageTags: '1man, nobleman, cape', budget: 99999, demand: 0, guestClass: 'commoner' })

test('提示词带身份、人设方向、需求方向和合法种族表', () => {
  const p = aiGuestPrompt(noble(), ['乙'])
  assert.ok(p.includes('客人身份：贵族') && p.includes('高傲的贵族'))
  assert.ok(p.includes(`需求方向（必须围绕它展开`) && p.includes(noble().desires))
  assert.ok(p.includes(VALID_RACES.join('、')))
  assert.ok(p.includes('"prefOutfit"') && p.includes('"prefRace"'))
  const plain = aiGuestPrompt(fxGuest({ prefOutfit: null, prefTrait: undefined }), [])
  assert.ok(plain.includes('客人身份：平民') && !plain.includes('"prefOutfit"') && !plain.includes('"prefTrait"'))
})

test('清洗：AI 不能改身份/预算/挑剔度/判定用需求，偏好只在合法时替换', () => {
  const base = noble()
  const g = parseAiGuest('好的：' + good + '（完）', base)!
  assert.equal(g.id, 'n1'); assert.equal(g.budget, 400); assert.equal(g.guestClass, 'noble'); assert.equal(g.demand, 8)
  assert.equal(g.desires, base.desires); assert.equal(g.desireKind, 'M'); assert.equal(g.desireService, '口侍')
  assert.equal(g.name, '冯·雷德'); assert.equal(g.race, '贵族·人类公爵'); assert.equal(g.desireDetail, '要她跪着用舌头侍奉')
  assert.equal(g.prefRace, '龙娘'); assert.equal(g.prefTrait, '贫乳'); assert.equal(g.prefOutfit, '和服')
  assert.equal(g.aiFlavored, true)
  // 非法值保留原值；原本没有的偏好不能凭空加
  const bad = sanitizeAiGuest({ name: 123, prefRace: '魅魔', prefTrait: '长腿', prefOutfit: '比基尼', traits: 'x', imageTags: 'landscape' }, base)
  assert.equal(bad.name, base.name); assert.equal(bad.prefRace, base.prefRace); assert.equal(bad.prefTrait, base.prefTrait)
  assert.equal(bad.prefOutfit, '制服'); assert.deepEqual(bad.traits, base.traits); assert.equal(bad.imageTags, base.imageTags)
  const noPref = sanitizeAiGuest({ prefOutfit: '和服' }, fxGuest({ prefOutfit: null }))
  assert.equal(noPref.prefOutfit, null)
  // 去掉换行/尖括号、限长
  assert.equal(sanitizeAiGuest({ personality: '<b>坏</b>\n'.repeat(40) }, base).personality!.includes('<'), false)
})

test('坏 JSON / 非对象 → null 或原样', () => {
  assert.equal(parseAiGuest('不是 JSON', noble()), null)
  assert.equal(parseAiGuest('{"name": ', noble()), null)
  assert.deepEqual(sanitizeAiGuest([1, 2], noble()), noble())
})

test('请求失败/超时/坏回复：静默保留随机客人，并记下当天已尝试', async () => {
  const guests = [createRandomGuest(80), createRandomGuest(10)]
  const s = save(guests)
  assert.equal(shouldGenerateAiGuests(s), true)
  const failed = await generateAiGuests(s, async () => { throw new Error('500') })
  assert.deepEqual(failed, [])
  const slow = await generateAiGuests(s, (_p, signal) => new Promise((_r, rej) => signal.addEventListener('abort', () => rej(new Error('abort')))), 20)
  assert.deepEqual(slow, [])
  const junk = await generateAiGuests(s, async () => '抱歉我不能')
  const after = applyAiGuests(s, 4, junk)
  assert.deepEqual(after.dailyGuests, guests)
  assert.equal(after.aiGuestsDay, 4)
  assert.equal(shouldGenerateAiGuests(after), false)
})

test('成功时只替换仍在池中的新客人，身份和预算不变；回头客与跨天结果不动', async () => {
  const fresh = createRandomGuest(80)
  const regular = fxGuest({ id: 'r', name: '老客', visits: 3 })
  const s = save([fresh, regular])
  const up = await generateAiGuests(s, async () => good)
  assert.equal(up.length, 1)
  // 玩家在结果回来前已接待了别人：只要 fresh 还在就换
  const after = applyAiGuests(s, 4, up)
  const g = after.dailyGuests!.find((x) => x.id === fresh.id)!
  assert.equal(g.name, '冯·雷德'); assert.equal(g.budget, fresh.budget); assert.equal(g.guestClass, fresh.guestClass); assert.equal(g.demand, fresh.demand)
  if (fresh.guestClass && fresh.guestClass !== 'commoner') assert.ok(g.race.startsWith(GUEST_CLASSES[fresh.guestClass].label + '·'))
  assert.equal(after.dailyGuests!.find((x) => x.id === 'r')!.name, '老客')
  // 已被接走的不回填；隔天的结果丢弃
  assert.equal(applyAiGuests({ ...s, dailyGuests: [regular] }, 4, up).dailyGuests!.length, 1)
  assert.equal(applyAiGuests({ ...s, currentDay: 5 }, 4, up).aiGuestsDay, undefined)
})
