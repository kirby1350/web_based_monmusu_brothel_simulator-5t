import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capViolations, detectTermCommands, resolveTerms } from './terms'
import { MM_TERMS, mmProfile } from './terms-canon'
import { mmTerms, mmTermsLine, termCommandsFor, applyTermCommands, corruptionOf } from './terms-mm'
import type { MonstGirl } from './types'

test('原作角色默认称呼不越界（母猪 / 肉便器只在崩坏档，千雪封顶妈妈的骚奶）', () => {
  for (const [name, p] of Object.entries(MM_TERMS)) assert.deepEqual(capViolations(p), [], name)
  const c = Object.entries(MM_TERMS).find(([n]) => n.includes('千雪'))
  assert.ok(c && c[1].maternal)
})

test('器官随快感临时、自称随堕落永久', () => {
  const p = Object.values(MM_TERMS)[0]
  const low = resolveTerms(p, undefined, { corruption: 10, pleasure: 0, now: 0 })
  const hot = resolveTerms(p, undefined, { corruption: 10, pleasure: 99, now: 0 })
  assert.equal(low.self.value, hot.self.value)
  assert.ok(hot.arousalTier > low.arousalTier)
  const deep = resolveTerms(p, undefined, { corruption: 90, pleasure: 0, now: 0 })
  assert.equal(deep.corruptTier, 3)
})

test('改称呼命令会被记住并写进本回合称呼', () => {
  assert.ok(detectTermCommands('以后叫自己小母狗').some((c) => c.slot === 'self' && c.value === '小母狗'))
  const g = { id: 'a', name: '测试娘', obedience: 30, lewdness: 30 } as MonstGirl
  const [hit] = termCommandsFor([g], '以后叫我主人。')
  assert.ok(hit)
  const g2 = applyTermCommands(g, hit.cmds, 'command')
  assert.equal(mmTerms(g2).player.value, '主人')
  assert.ok(mmTermsLine(g2).includes('叫馆主「主人」'))
  assert.equal(corruptionOf(g), 30)
  assert.ok(mmProfile({ name: '无名' }).self.length === 4)
})
