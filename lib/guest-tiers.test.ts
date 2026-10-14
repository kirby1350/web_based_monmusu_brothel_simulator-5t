import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rollGuestClass, createRandomGuest, GUEST_CLASSES } from './game-engine'
import { resolveService } from './resolve-service'
import { buildGuestGenerationPrompt } from './prompt-builder'
import { fxGirl, fxGuest } from './prompt-fixtures'

test('声望 <40 全是平民且不消耗随机数（早期不变）', () => {
  let calls = 0
  const rng = () => { calls++; return 0 }
  assert.equal(rollGuestClass(39, rng), 'commoner'); assert.equal(calls, 0)
  const g = createRandomGuest(10)
  assert.equal(g.guestClass, undefined); assert.equal(g.demand, undefined)
})

test('40–69 出商人/冒险者，70+ 出贵族/队长', () => {
  assert.equal(rollGuestClass(50, () => 0.1), 'merchant')
  assert.equal(rollGuestClass(50, () => 0.9), 'commoner')
  assert.equal(rollGuestClass(80, () => 0.1), 'noble')
  assert.equal(rollGuestClass(80, (() => { const v = [0.1, 0.9]; let i = 0; return () => v[i++] })()), 'captain')
  assert.equal(rollGuestClass(80, () => 0.95), 'commoner')
})

test('高档客人预算更高、更挑剔、一定有服装喜好', () => {
  const orig = Math.random
  try {
    Math.random = () => 0.1
    const hi = createRandomGuest(80)
    Math.random = () => 0.1
    const lo = createRandomGuest(20)
    assert.equal(hi.guestClass, 'noble')
    assert.equal(hi.demand, GUEST_CLASSES.noble.demand)
    assert.ok(hi.race.startsWith('贵族·'))
    assert.ok(hi.prefOutfit)
    // 同样的随机序列下，贵族预算 = 平民 × 1.8（声望项不同，单独比较倍率）
    assert.ok((hi.budget ?? 0) > (lo.budget ?? 0) * 1.5)
  } finally { Math.random = orig }
})

test('demand 直接从满意度里扣', () => {
  const g = fxGuest({ prefRace: undefined, prefTrait: undefined, prefOutfit: null })
  const a = resolveService({ girl: fxGirl(), guest: g, skip: false, roomLevel: 1 })
  const b = resolveService({ girl: fxGirl(), guest: { ...g, demand: 8 }, skip: false, roomLevel: 1 })
  assert.equal(a.satisfaction - b.satisfaction, 8)
})

test('客人生成提示词带身份', () => {
  assert.ok(buildGuestGenerationPrompt('', [], '贵族').includes('客人身份：贵族'))
  assert.ok(!buildGuestGenerationPrompt('', []).includes('客人身份'))
})
