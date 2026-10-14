import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave } from './types'
import { TUTORIAL_STEPS, isTutorialVisible, advanceTutorial, dismissTutorial } from './tutorial'
import { migrateSave } from './migrate-save'

const base = (day = 1): GameSave => migrateSave({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 500, day, guestPreference: '', marketPreference: '' },
  girls: [], currentDay: day, phase: 'morning',
})

test('引导 3–5 步，第一天新档可见', () => {
  assert.ok(TUTORIAL_STEPS.length >= 3 && TUTORIAL_STEPS.length <= 5)
  assert.equal(isTutorialVisible(base()), true)
  assert.equal(isTutorialVisible(base(2)), false)
})

test('逐步前进，最后一步后关闭', () => {
  let s = base()
  for (let i = 1; i < TUTORIAL_STEPS.length; i++) { s = advanceTutorial(s); assert.equal(s.tutorial?.step, i); assert.ok(isTutorialVisible(s)) }
  s = advanceTutorial(s)
  assert.equal(s.tutorial?.dismissed, true)
  assert.equal(isTutorialVisible(s), false)
})

test('跳过立即关闭且写入存档', () => {
  const s = dismissTutorial(advanceTutorial(base()))
  assert.deepEqual(s.tutorial, { step: 1, dismissed: true })
  assert.equal(isTutorialVisible(migrateSave(s)), false)
})
