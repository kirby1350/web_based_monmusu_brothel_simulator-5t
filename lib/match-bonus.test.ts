import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Guest, MonstGirl } from './types'
import { resolveService } from './resolve-service'
import { resolveLiveSteps, initLiveState } from './live-steps'
import { SKIP_MATCH_BONUS } from './catalog'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 30, obedience: 50, lewdness: 50, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 }, ...o,
})
// 主需求身侍（中性），副需求待客；喜好制服
const guest = (o: Partial<Guest> = {}): Guest => ({ id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0, budget: 100, prefOutfit: '制服', ...o })
const trained = girl({ skillRanks: { 身侍: '熟练', 待客: '熟练', 手技: '初学' } })

test('三个维度叠加：主类型 +6、对口 play +4、服装 +5', () => {
  const r = resolveService({ girl: trained, guest: guest(), skip: true, roomLevel: 2, outfit: 'maid' })
  assert.ok(r.plays.some((p) => p.matched))
  assert.equal(r.matchBonus, SKIP_MATCH_BONUS.service + SKIP_MATCH_BONUS.play + SKIP_MATCH_BONUS.outfit)
  assert.ok(r.satisfaction >= 70 && r.satisfaction <= 87, `full match ${r.satisfaction}`) // 服装迎客 +6 后从 84 升到 86，仍是「满意」
  assert.equal(r.tier.key, 'satisfied')
})

test('不对口的组合保持一般/不满', () => {
  const untrained = girl({ obedience: 30, lewdness: 30 })
  const r = resolveService({ girl: untrained, guest: guest(), skip: true, roomLevel: 2, outfit: 'regular' })
  assert.equal(r.matchBonus, 0)
  assert.ok(r.satisfaction < 70, String(r.satisfaction))
})

test('亲自上场不加匹配加成', () => {
  const plan = { girl: trained, guest: guest(), roomLevel: 2, outfit: 'maid' as const, stockings: 'none' as const }
  const live = resolveLiveSteps(plan, { ...initLiveState(plan), stepIndex: 4, turns: [1, 1, 1, 1, 1] })
  assert.equal(live.matchBonus ?? 0, 0)
  assert.equal(resolveService({ ...plan, skip: false }).matchBonus, 0)
})

test('只有主类型对口（一级房、常服、无 play）时不越过 70', () => {
  const maxed = girl({ obedience: 100, lewdness: 100, skillRanks: { 身侍: '精通', 待客: '精通', 手技: '精通' }, sensitivities: { 耳朵: 90, 阴蒂: 90, 小穴: 90 } })
  const r = resolveService({ girl: maxed, guest: guest(), skip: true, roomLevel: 1, outfit: 'regular' })
  assert.ok(r.satisfaction <= 70)
  const mid = resolveService({ girl: trained, guest: guest({ prefOutfit: null }), skip: true, roomLevel: 1 })
  assert.equal(mid.matchBonus, SKIP_MATCH_BONUS.service)
})
