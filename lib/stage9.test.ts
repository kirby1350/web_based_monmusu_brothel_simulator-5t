import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import { RACE_PLAYS, RACE_TRAITS, RACE_ZONE_NAMES, PLAY_SCORE } from './catalog'
import { getAvailablePlays, scorePlay, autoPickPlays, resolveService } from './resolve-service'
import { migrateSave } from './migrate-save'
import { RACES, GIRL_TEMPLATES } from './game-data'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '人类', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 100,
  sensitivities: { 耳朵: 30, 阴蒂: 30, 唇舌: 30, 乳房: 30, 小穴: 30, 后庭: 15, 种族: 30 }, ...o,
})
const guest = (o: Partial<Guest> = {}): Guest => ({ id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '追求长时间的多次内射', imageTags: '', satisfaction: 0, budget: 100, ...o })
const M = guest({ desires: '想把高傲的魔物娘彻底操服' })
const S = guest({ desires: '想被嫌弃着榨干' })
const play = (race: string, name: string) => RACE_PLAYS[race].find((p) => p.name === name)!

test('每个有种族特技的种族至少一条专属 play；通用种族特技已删除', () => {
  for (const r of Object.keys(RACE_TRAITS)) if (r !== '精灵' || RACE_PLAYS[r]) assert.ok((RACE_PLAYS[r] ?? []).length >= 1, r)
  assert.equal(RACE_PLAYS['拉米亚'].map((p) => p.name).join(','), '缠绕,石化凝视,蛇发缠绕')
  assert.ok(!getAvailablePlays(girl(), guest()).some((p) => p.source === 'race'))
  assert.equal(play('龙娘', '龙威压制').rank, '精通')
  assert.equal(play('魔女', '淫纹魔法').rank, '熟练')
})

test('只有本种族能选，不用先学', () => {
  const lamia = getAvailablePlays(girl({ race: '拉米亚' }), M).filter((p) => p.source === 'race').map((p) => p.name)
  assert.deepEqual(lamia, ['缠绕', '石化凝视', '蛇发缠绕'])
  assert.ok(!getAvailablePlays(girl({ race: '猫娘' }), M).some((p) => p.race === '拉米亚'))
})

test('对口判定与表一致；不对口减半；敏感带修正', () => {
  const lamia = girl({ race: '拉米亚' })
  assert.equal(scorePlay(lamia, M, play('拉米亚', '缠绕')).matched, true)
  assert.equal(scorePlay(lamia, M, play('拉米亚', '缠绕')).score, PLAY_SCORE['熟练'])
  assert.equal(scorePlay(lamia, S, play('拉米亚', '缠绕')).score, Math.floor(PLAY_SCORE['熟练'] / 2))
  const witch = girl({ race: '魔女' })
  assert.equal(scorePlay(witch, S, play('魔女', '淫纹魔法')).matched, true)
  assert.equal(scorePlay(witch, guest(), play('魔女', '淫纹魔法')).matched, true)
  assert.equal(scorePlay(witch, M, play('魔女', '淫纹魔法')).matched, false)
  const dragon = girl({ race: '龙娘' })
  assert.equal(scorePlay(dragon, S, play('龙娘', '龙威压制')).score, PLAY_SCORE['精通'])
  assert.equal(scorePlay(girl({ race: '猫娘' }), guest({ desires: '喜欢摸尾巴和兽耳' }), play('猫娘', '尾巴缠弄')).matched, true)
  const hot = girl({ race: '拉米亚', sensitivities: { 种族: 60 } })
  assert.ok(scorePlay(hot, M, play('拉米亚', '缠绕')).score > PLAY_SCORE['熟练'])
})

test('正戏主类型限制：同类型 skill play 不能当额外 play；自动填选中对口的专属 play', () => {
  const lamia = girl({ race: '拉米亚', skillRanks: { 身侍: '熟练' } })
  assert.ok(!getAvailablePlays(lamia, M).some((p) => p.source === '身侍'))
  const picks = autoPickPlays(lamia, M, 1)
  assert.ok(['race_lamia_coil', 'race_lamia_gaze'].includes(picks[0]), picks.join())
  const r = resolveService({ girl: lamia, guest: M, skip: true, roomLevel: 2 })
  assert.ok(r.plays.some((p) => p.name === '缠绕' || p.name === '石化凝视'))
})

test('美杜莎：种族表删除；旧档迁移为拉米亚，三条 play 可选，敏感带数值保留，幂等', () => {
  assert.ok(!RACES.some((r) => r.name === '美杜莎'))
  assert.equal(RACE_ZONE_NAMES['美杜莎'], undefined)
  assert.equal(GIRL_TEMPLATES.find((t) => t.name === '文香')?.race, '蜘蛛娘')
  const old = {
    player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 1, guestPreference: '', marketPreference: '' },
    girls: [girl({ race: '美杜莎', sensitivities: { 耳朵: 30, 种族: 70 } }), girl({ id: 'b', race: '阿拉克涅' })],
    dailyGuests: [guest({ prefRace: '美杜莎' })],
    currentDay: 1, phase: 'morning',
  } as unknown as GameSave
  const m = migrateSave(old)
  assert.equal(m.girls[0].race, '拉米亚'); assert.equal(m.girls[0].sensitivities!['种族'], 70)
  assert.equal(m.girls[1].race, '蜘蛛娘')
  assert.equal(m.dailyGuests![0].prefRace, '拉米亚')
  assert.equal(getAvailablePlays(m.girls[0], M).filter((p) => p.race === '拉米亚').length, 3)
  assert.deepEqual(migrateSave(m), m)
})

test('拉米亚、蜘蛛娘不再有被动天赋；旧档照常结算', () => {
  assert.equal(RACE_TRAITS['拉米亚'], undefined)
  assert.equal(RACE_TRAITS['蜘蛛娘'], undefined)
  assert.equal(RACE_ZONE_NAMES['蜘蛛娘'], '丝腺')
  assert.ok(resolveService({ girl: girl({ race: '蜘蛛娘' }), guest: M, skip: true, roomLevel: 2 }).plays.some((p) => p.name === '丝线束缚'))
})
