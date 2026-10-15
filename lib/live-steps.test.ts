import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Guest, MonstGirl } from './types'
import { resolveService } from './resolve-service'
import {
  initLiveState, nextStep, recordTurn, changeOutfit, canChangeOutfit, insertablePlays, insertPlay, resolveLiveSteps, liveStepScore,
} from './live-steps'

const girl: MonstGirl = {
  id: 'a', name: 'A', race: '猫娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  skillRanks: { 待客: '初学', 口侍: '熟练' },
}
const guest: Guest = { id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '想把高傲的魔物娘彻底操服', imageTags: '', satisfaction: 0, budget: 100, prefOutfit: '制服' }
const plan = (roomLevel = 1) => ({ girl, guest, roomLevel, outfit: 'regular' as const, stockings: 'none' as const })

const walk = (s = initLiveState(plan()), turnsEach = 1) => {
  for (let i = 0; i < 5; i++) { for (let t = 0; t < turnsEach; t++) s = recordTurn(s); s = nextStep(s) }
  return s
}

test('步骤条依次推进五步，清洗后再按下一步即结束', () => {
  let s = initLiveState(plan())
  const seen: number[] = []
  for (let i = 0; i < 5; i++) { seen.push(s.stepIndex); s = nextStep(s) }
  assert.deepEqual(seen, [0, 1, 2, 3, 4])
  assert.equal(s.finished, true)
})

test('每步写 1 回合 = 跳过公式（非龙娘），多写回合更高，单步封顶 14', () => {
  const one = resolveLiveSteps(plan(), walk())
  assert.equal(one.satisfaction, resolveService({ ...plan(), skip: false }).satisfaction)
  const three = resolveLiveSteps(plan(), walk(undefined, 3))
  assert.ok(three.satisfaction > one.satisfaction)
  three.steps.forEach((x) => assert.ok(x.score <= 14))
  assert.equal(liveStepScore(13, 5, true), 14)
})

test('提前结束：没走到的步骤记 0，可以低于跳过', () => {
  let s = initLiveState(plan()); s = recordTurn(s); s = nextStep(s); s = recordTurn(s)
  const r = resolveLiveSteps(plan(), s)
  assert.equal(r.steps[2].score, 0); assert.equal(r.steps[4].score, 0)
  assert.ok(r.satisfaction < resolveService({ ...plan(), skip: true }).satisfaction)
  assert.equal(r.affectionDelta, 0)
})

test('换装只在挑逗、只一次；迎客按新衣服重算，体力多掉 5', () => {
  let s = initLiveState(plan())
  assert.equal(canChangeOutfit(s), false)
  assert.equal(changeOutfit(s, 'maid', 'none'), s)
  s = nextStep(s)
  assert.equal(canChangeOutfit(s), true)
  const before = resolveLiveSteps(plan(), walk())
  let c = initLiveState(plan()); c = recordTurn(c); c = nextStep(c); c = changeOutfit(c, 'maid', 'none')
  assert.equal(canChangeOutfit(c), false)
  for (let i = 1; i < 5; i++) { c = recordTurn(c); c = nextStep(c) }
  const after = resolveLiveSteps(plan(), c)
  assert.equal(after.steps[0].score, before.steps[0].score + 6) // 常服 0 → 女仆装对上「制服」+6
  assert.equal(after.staminaCost, before.staminaCost + 5)
})

test('一级房不能插入 play；二级房能插 1 个并计分', () => {
  assert.equal(insertablePlays(plan(1), initLiveState(plan(1))).length, 0)
  let s = initLiveState(plan(2))
  const opts = insertablePlays(plan(2), s)
  assert.ok(opts.length > 0)
  s = insertPlay(plan(2), s, opts[0].id)
  assert.equal(s.plays[0].position, 'before')
  assert.equal(insertablePlays(plan(2), s).length, 0)
  const r = resolveLiveSteps(plan(2), walk(s))
  assert.equal(r.plays.length, 1)
})

test('体力按回合：4 回合以内 −25，更长 −55', () => {
  let s = initLiveState(plan()); for (let i = 0; i < 5; i++) s = nextStep(s)
  assert.equal(resolveLiveSteps(plan(), s).staminaCost, 25)
  assert.equal(resolveLiveSteps(plan(), walk()).staminaCost, 55)
})
