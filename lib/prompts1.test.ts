import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLAYS, RACE_PLAYS, ALL_PLAYS } from './catalog'
import { PRESET_FLOWS } from './service-flows'
import { PLAY_CRAFT, SKILL_CRAFT, STEP_HOW, RACE_FLOW_DETAIL, buildCraftBlock, playTier, presetFlowRace, playStepOf } from './play-prompts'
import { fxGirl as makeGirl } from './prompt-fixtures'

test('1. 每个 play（7 通用 + 23 种族）和 7 项技能都有要点/感官/三档', () => {
  assert.equal(PLAYS.length, 7)
  assert.equal(Object.values(RACE_PLAYS).flat().length, 23)
  for (const p of ALL_PLAYS) {
    const e = PLAY_CRAFT[p.id]
    assert.ok(e, p.id)
    assert.ok(e.essence.length > 20 && e.sense.length > 15, p.id)
    for (const t of ['初学', '熟练', '精通'] as const) assert.ok(e.tiers[t].length > 6, `${p.id} ${t}`)
  }
  for (const k of ['待客', '手技', '口侍', '胸侍', '身侍', 'M性', 'S性'] as const) assert.ok(SKILL_CRAFT[k].tiers['精通'])
  assert.equal(STEP_HOW.length, 5)
  for (const f of PRESET_FLOWS) assert.equal(RACE_FLOW_DETAIL[f.race]?.length, 5, f.race)
})

test('1. 写作素材只注入当前步骤与挂在这一步的 play，档位随熟练度', () => {
  const g = makeGirl({ race: '牛娘', proficiency: { 待客: 0, 手技: 0, 口侍: 0, 胸侍: 80, 身侍: 0, M性: 0, S性: 0 } })
  const b3 = buildCraftBlock({ stepIndex: 3, girl: g, mainSkill: '胸侍', playIds: ['race_cow_milk'], flowRace: '牛娘' })
  assert.match(b3, /乳汁侍奉/)
  assert.match(b3, /胸侍（/)
  assert.match(b3, /奶香越来越浓/)
  assert.doesNotMatch(b3, /深喉/)
  const b0 = buildCraftBlock({ stepIndex: 0, girl: g, mainSkill: '胸侍', playIds: [], flowRace: '牛娘' })
  assert.match(b0, /迎客：/)
  assert.match(b0, /待客（.*未学/)
  assert.doesNotMatch(b0, /乳汁侍奉/)
  assert.ok(b3.length < 900, `size ${b3.length}`)
  assert.equal(playTier(g, 'paizuri'), playTier(g, 'race_cow_milk'))
})

test('1. 内置流程细节只在这一步没改过时给；play 的步骤归属', () => {
  const pf = PRESET_FLOWS.find((f) => f.race === '牛娘')!
  assert.equal(presetFlowRace({ choice: pf.id, actions: pf.actions }, 2), '牛娘')
  const edited = pf.actions.map((a, i) => (i === 2 ? '改过的' : a))
  assert.equal(presetFlowRace({ choice: pf.id, actions: edited }, 2), undefined)
  assert.equal(presetFlowRace({ choice: 'std', actions: pf.actions }, 2), undefined)
  assert.equal(playStepOf('x', { x: 1 }, { x: 2 }), 1)
  assert.equal(playStepOf('x', undefined, { x: 2 }), 2)
  assert.equal(playStepOf('x', undefined, undefined), 3)
})
