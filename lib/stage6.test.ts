import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, MonstGirl } from './types'
import { buildBehaviourLines, stepBehaviour, buildServiceSystemPrompt } from './prompt-builder'
import { pickArrivalLeader, arrivalFallbackText, mergeGirlMemory, mergeRegularMemories } from './hub-logic'
import { migrateSave } from './migrate-save'
import { GIRL_TEMPLATES as PRESET_TEMPLATES_FOR_TEST } from './game-data'
import { RACE_TRAITS } from './catalog'
import { resolveService } from './resolve-service'
import { createServiceSession } from './game-engine'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 }, ...o,
})

test('挑逗步耳朵为弱点时出现弱点那句；切到下一步后不再出现', () => {
  const g = girl({ sensitivities: { 耳朵: 90, 阴蒂: 30 }, skillRanks: { 手技: '精通' } })
  const tease = buildBehaviourLines(g.name, stepBehaviour(g, 1, '耳朵', undefined, []))
  assert.match(tease, /耳朵（弱点）：一碰就失守/)
  const fore = buildBehaviourLines(g.name, stepBehaviour(g, 2, '阴蒂', undefined, []))
  assert.doesNotMatch(fore, /耳朵/)
  assert.match(fore, /手技（精通）：游刃有余/)
  assert.match(fore, /阴蒂（普通）/)
})

test('正戏含主类型和已插入 play；未学技能写未学；清洗不加', () => {
  const g = girl({ skillRanks: { 口侍: '初学' } })
  const main = buildBehaviourLines(g.name, stepBehaviour(g, 3, '小穴', '身侍', ['deepthroat']))
  assert.match(main, /身侍（未学）/); assert.match(main, /口侍（初学）/); assert.match(main, /唇舌（普通）/)
  assert.equal(buildBehaviourLines(g.name, stepBehaviour(g, 4, undefined, undefined, [])), '')
  assert.match(buildBehaviourLines(g.name, stepBehaviour(g, 0, undefined, undefined, [])), /待客（未学）/)
})

test('行为句子随 stepContext 进入系统提示词；计分不变', () => {
  const g = girl({ sensitivities: { 耳朵: 90 } })
  const lines = buildBehaviourLines(g.name, stepBehaviour(g, 1, '耳朵', undefined, []))
  const session = createServiceSession('service', [g], {})
  const prompt = buildServiceSystemPrompt({ name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 1, guestPreference: '', marketPreference: '' }, session, 'standard', lines)
  assert.ok(prompt.includes('一碰就失守'))
  const guest = { id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0 }
  assert.equal(resolveService({ girl: g, guest, skip: true }).satisfaction, resolveService({ girl: g, guest, skip: true }).satisfaction)
})

test('入馆领头人：好感 ≥50 的最高者，并列取先入馆，不含新人；都不到时馆主', () => {
  const a = girl({ id: 'a', name: '甲', affection: 60 })
  const b = girl({ id: 'b', name: '乙', affection: 80 })
  const c = girl({ id: 'c', name: '丙', affection: 80 })
  const n = girl({ id: 'n', name: '新', affection: 99 })
  const l = pickArrivalLeader([a, b, c, n], 'n')
  assert.equal(l.kind, 'girl'); if (l.kind === 'girl') assert.equal(l.girl.name, '乙')
  assert.equal(pickArrivalLeader([girl({ affection: 49 }), n], 'n').kind, 'player')
  assert.match(arrivalFallbackText(l, '馆主', n), /乙.*新/)
  assert.match(arrivalFallbackText({ kind: 'player' }, '馆主', n), /馆主.*新/)
})

test('常客记忆合并：visitCount 递增，回头客池同步', () => {
  const m1 = mergeGirlMemory(undefined, 'A', { guestAboutGirl: 'x', girlAboutGuest: 'y' })
  const m2 = mergeGirlMemory(m1, 'A', { guestAboutGirl: 'x2' })
  assert.equal(m2.A.visitCount, 2); assert.equal(m2.A.guestAboutGirl, 'x2')
  const regs = [{ id: 'c', name: 'C', race: '', personality: '', traits: [], desires: '', imageTags: '', satisfaction: 0 }]
  assert.deepEqual(mergeRegularMemories(regs, 'c', m2)[0].memories, m2)
  assert.equal(mergeRegularMemories(regs, 'zz', m2)[0].memories, undefined)
})

test('文香：预设种族为蜘蛛娘；旧档阿拉克涅迁移为蜘蛛娘并补丝腺', () => {
  assert.equal(PRESET_TEMPLATES_FOR_TEST.find((t) => t.name === '文香')?.race, '蜘蛛娘')
  const old = {
    player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 1, guestPreference: '', marketPreference: '' },
    girls: [girl({ race: '阿拉克涅', sensitivities: undefined })], currentDay: 1, phase: 'morning',
  } as unknown as GameSave
  const m = migrateSave(old)
  assert.equal(m.girls[0].race, '蜘蛛娘')
  assert.equal(m.girls[0].sensitivities!['种族'], 55)
  assert.ok(RACE_TRAITS[m.girls[0].race])
  assert.deepEqual(migrateSave(m), m)
})
