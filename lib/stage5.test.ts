import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import { resolveTraining, resolveLiveTraining, canDrillTwoSided } from './resolve-training'
import { resolveService, getAvailablePlays, scorePlay } from './resolve-service'
import { applyTrainingToSave } from './settle-session'
import { sculptPrice } from './shop'
import { PLAYS } from './catalog'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 }, ...o,
})
const guest = (o: Partial<Guest> = {}): Guest => ({ id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0, budget: 100, ...o })
const save = (g: MonstGirl, inv: Record<string, number> = {}): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 777, day: 1, guestPreference: '', marketPreference: '', inventory: inv },
  girls: [g], currentDay: 1, phase: 'morning', actionsUsedToday: 0,
})

test('跳过驯服：服从增加、金币不变、行动 +1', () => {
  const g = girl()
  const r = resolveTraining({ girl: g, direction: 'tame', skip: true })
  const s = applyTrainingToSave(save(g), r)
  assert.equal(s.girls[0].obedience, 46)
  assert.equal(s.player.gold, 777)
  assert.equal(s.actionsUsedToday, 1)
  assert.equal(s.girls[0].stamina, 80)
})

test('练习镜：特训进度比空房多 1', () => {
  const g = girl({ skillRanks: { 手技: '初学' } })
  const empty = resolveTraining({ girl: g, direction: 'drill', skill: '手技', skip: true })
  const mirror = resolveTraining({ girl: g, direction: 'drill', skill: '手技', skip: true, props: ['mirror'] })
  assert.equal(mirror.delta.skillProgress, empty.delta.skillProgress + 1)
  assert.equal(mirror.girl.skillRanks!['手技'], '熟练')
})

test('丰乳香膏：胸围 +5、药出背包、下一瓶更贵；魔女 ×1.5，塑形架 +1', () => {
  const g = girl()
  const r = resolveTraining({ girl: g, direction: 'sculpt', potionId: 'bust_up', skip: true })
  const s = applyTrainingToSave(save(g, { bust_up: 1 }), r, 'bust_up')
  assert.equal(s.girls[0].bust, 90)
  assert.equal(s.player.inventory!.bust_up, undefined)
  assert.equal(sculptPrice(s, 'bust'), 260)
  assert.equal(resolveTraining({ girl: girl({ race: '魔女' }), direction: 'sculpt', potionId: 'bust_up', skip: true }).girl.bust, 93)
  assert.equal(resolveTraining({ girl: g, direction: 'sculpt', potionId: 'bust_up', skip: true, props: ['sculpt_frame'] }).girl.bust, 91)
})

test('敏感开发：耳朵 30→40（耳羽 +4），到 40 即「敏感」，挑逗分上升', () => {
  const g = girl()
  assert.equal(resolveTraining({ girl: g, direction: 'sensitize', zone: '耳朵', skip: true }).girl.sensitivities!['耳朵'], 40)
  assert.equal(resolveTraining({ girl: g, direction: 'sensitize', zone: '耳朵', skip: true, props: ['feather'] }).delta.sensitivity, 14)
  const tease = (x: MonstGirl) => resolveService({ girl: x, guest: guest(), skip: true }).steps[1].score
  const dev = resolveTraining({ girl: g, direction: 'sensitize', zone: '耳朵', skip: true, roomLevel: 4, props: ['feather'] }).girl
  assert.equal(dev.sensitivities!['耳朵'], 54)
  const one = resolveTraining({ girl: g, direction: 'sensitize', zone: '耳朵', skip: true }).girl
  assert.ok(tease(one) > tease(g), '30→40 后挑逗分应上升')
  assert.equal(tease(dev), tease(g) + 3)
})

test('道具与服装只加成对口方向，不吃倍率', () => {
  const g = girl()
  assert.equal(resolveTraining({ girl: g, direction: 'tame', skip: true, props: ['whip'] }).delta.obedience, 9)
  assert.equal(resolveTraining({ girl: g, direction: 'tame', skip: true, props: ['whip'] }).staminaCost, 30)
  assert.equal(resolveTraining({ girl: g, direction: 'tame', skip: true, roomLevel: 4, props: ['whip'], outfit: 'restraint' }).delta.obedience, 16)
  assert.equal(resolveTraining({ girl: g, direction: 'release', skip: true, props: ['massage_table'] }).staminaCost, 10)
  assert.equal(resolveTraining({ girl: g, direction: 'release', skip: true, props: ['whip'] }).delta.lewdness, 6)
  assert.equal(resolveTraining({ girl: g, direction: 'sensitize', zone: '小穴', skip: true, outfit: 'crotchless' }).delta.sensitivity, 12)
  assert.equal(resolveTraining({ girl: g, direction: 'tame', skip: true, props: ['rack'] }).delta.m, 2)
})

test('亲自上场调教：一两句减半；回合多快感高主项 +2', () => {
  const g = girl()
  assert.equal(resolveLiveTraining({ girl: g, direction: 'tame' }, 1, 0).delta.obedience, 3)
  assert.equal(resolveLiveTraining({ girl: g, direction: 'tame' }, 4, 0).delta.obedience, 6)
  assert.equal(resolveLiveTraining({ girl: g, direction: 'tame' }, 7, 80).delta.obedience, 8)
  const d = resolveLiveTraining({ girl: girl({ skillRanks: { 手技: '初学' } }), direction: 'drill', skill: '手技' }, 7, 80)
  assert.equal(d.delta.skillProgress, 3)
})

test('两面：服从淫乱都 70 且有 M/S 才能练；两边 play 都能选、对口按熟练', () => {
  const g = girl({ obedience: 70, lewdness: 70, inclination: 'M', skillRanks: { 'M性': '精通' } })
  assert.equal(canDrillTwoSided(girl({ obedience: 70, lewdness: 69, inclination: 'M' })), false)
  const r = resolveTraining({ girl: g, direction: 'drill', skill: '两面', skip: true })
  assert.equal(r.girl.inclination, '两面')
  const ids = getAvailablePlays(r.girl, guest()).map((p) => p.id)
  assert.ok(ids.includes('endure') && ids.includes('drain'))
  const sGuest = guest({ desires: '渴望被傲娇的魔物娘嫌弃着榨干' })
  assert.equal(scorePlay(r.girl, sGuest, PLAYS.find((p) => p.id === 'drain')!).score, 8)
})

test('种族特技', () => {
  const base = (race: string, o: Partial<MonstGirl> = {}, gi: Partial<Guest> = {}, extra = {}) =>
    resolveService({ girl: girl({ race, ...o }), guest: guest(gi), skip: true, ...extra })
  // 狐娘魅惑：偏好全没中，迎客 +2
  assert.equal(base('狐娘').steps[0].score, base('人类').steps[0].score + 2)
  // 兔娘持久：当天第二场体力 ×0.75
  assert.equal(base('兔娘', {}, {}, { girlSessionsToday: 1 }).staminaCost, 30)
  // 精灵：体力 ×1.25
  assert.equal(base('精灵').staminaCost, 50)
  // 黑暗精灵夜习：第 2 场 +5
  assert.equal(base('黑暗精灵', {}, {}, { sessionIndexToday: 1 }).satisfaction, base('黑暗精灵').satisfaction + 5)
  // 狼娘/鬼娘：正戏身侍 +2
  assert.equal(base('狼娘').steps[3].score, base('人类').steps[3].score + 2)
  // 史莱姆柔体：低体力惩罚减半
  const low = { stamina: 10 }
  assert.equal(base('人类').standardScore - base('人类', low).standardScore, 8)
  assert.equal(base('史莱姆').standardScore - base('史莱姆', low).standardScore, 4)
  // 龙娘：满意后收入 ×1.2
  const hi = { obedience: 90, lewdness: 90, skillRanks: { 待客: '精通' as const, 手技: '精通' as const, 身侍: '精通' as const, 口侍: '精通' as const } }
  const room = { roomLevel: 2 }
  const dragon = base('龙娘', hi, { budget: 100 }, room)
  assert.ok(dragon.satisfaction >= 70)
  assert.equal(dragon.reward, Math.round(base('人类', hi, { budget: 100 }, room).reward * 1.2))
  // 吸血鬼反哺：满意后返还 15 体力
  assert.equal(base('吸血鬼', hi, {}, room).staminaCost, 25)
  // 拉米亚：想施虐客人时种族 play 对口
  const lamia = girl({ race: '拉米亚' })
  const race = PLAYS.find((p) => p.id === 'race')!
  assert.equal(scorePlay(lamia, guest({ desires: '想把高傲的魔物娘彻底操服' }), race).matched, true)
  // 兽耳偏好：猫娘迎客 +2
  assert.equal(base('猫娘', {}, { prefTrait: '兽耳' }).steps[0].score, base('猫娘').steps[0].score + 2)
})

test('同一魔物娘 + 同一客人：耳朵 30 → 40 后挑逗预览分严格更高', () => {
  const g = girl({ sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15 } })
  const c = guest()
  const before = resolveService({ girl: g, guest: c, skip: true }).steps[1]
  const after = resolveService({ girl: { ...g, sensitivities: { ...g.sensitivities, 耳朵: 40 } }, guest: c, skip: true }).steps[1]
  assert.equal(before.key, 'tease')
  assert.ok(after.score > before.score, `${before.score} → ${after.score}`)
})
