// v3 平衡（sim-30days-v3）：旧 5 人初始数值 +10、服装对口迎客 +6、恢复药（含热餐）每人每天一次
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import { GIRL_TEMPLATES } from './game-data'
import { OUTFIT_GREET_BONUS, OUTFIT_GREET_MISMATCH } from './catalog'
import { resolveService } from './resolve-service'
import { refreshPresetText } from './preset-refresh'
import { migrateSave } from './migrate-save'
import { buyRecovery, useRecovery, recoveryUsedToday } from './shop'
import { endDay } from './hub-logic'

const tpl = (name: string) => GIRL_TEMPLATES.find((t) => t.name === name)!
const stats = (name: string) => { const t = tpl(name); return [t.affection, t.obedience, t.lewdness] }
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)

// v2（b2dd9d9）的 好/服/淫
const OLD_V2: Record<string, number[]> = {
  千雪: [28, 25, 45], 娜露梅亚: [22, 20, 40], 露埃拉: [26, 28, 38], 文香: [18, 12, 25], 志希: [25, 18, 35],
}
const NEW_UNCHANGED: Record<string, number[]> = {
  柴郡: [40, 30, 40], 爱宕: [35, 20, 50], 赤城: [45, 15, 50], 大凤: [50, 30, 60],
  金狮: [35, 30, 40], 筑摩: [30, 25, 35], 今泉影狼: [20, 25, 30],
}

test('旧 5 人：好+服+淫 各 +10，任一项不降、都在 0–100，且不白送技能阈值（服 <30、好 <50）', () => {
  for (const [name, before] of Object.entries(OLD_V2)) {
    const now = stats(name)
    assert.equal(sum(now) - sum(before), 10, name)
    now.forEach((v, i) => { assert.ok(v >= before[i], `${name}[${i}]`); assert.ok(v >= 0 && v <= 100) })
    assert.ok(now[1] < 30 && now[0] < 50, `${name} 不该开局就弹技能选择`)
    // 原本已经过淫乱 40 的保持，不足 40 的不推过 40
    if (before[2] < 40) assert.ok(now[2] < 40, `${name} 淫乱`)
  }
  // 娜露梅亚、志希的服从补到 25，开局就能跳过接客；文香仍需先驯服但更近
  assert.equal(tpl('娜露梅亚').obedience, 25)
  assert.equal(tpl('志希').obedience, 25)
  assert.equal(tpl('文香').obedience, 20)
})

test('新 7 人初始数值不变（大凤不动）', () => {
  for (const [name, v] of Object.entries(NEW_UNCHANGED)) assert.deepEqual(stats(name), v, name)
})

test('老存档里的旧预设：文案刷新不碰好感/服从/淫乱（玩家进度不被覆盖）', () => {
  for (const [name, [a, o, l]] of Object.entries(OLD_V2)) {
    const g = { ...tpl(name), id: name, affection: a, obedience: o, lewdness: l } as MonstGirl
    const r = refreshPresetText(g)
    assert.deepEqual([r.affection, r.obedience, r.lewdness], [a, o, l], name)
    const grown = { ...g, affection: 66, obedience: 70, lewdness: 12 }
    const m = migrateSave({ player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 0, day: 3, guestPreference: '', marketPreference: '' },
      girls: [grown], currentDay: 3, phase: 'morning', actionsUsedToday: 0 } as GameSave).girls[0]
    assert.deepEqual([m.affection, m.obedience, m.lewdness], [66, 70, 12], `${name} migrate`)
  }
})

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '猫娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 20, ...o,
})
const guest = (prefOutfit: Guest['prefOutfit']): Guest => ({ id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '想把高傲的魔物娘彻底操服', imageTags: '', satisfaction: 0, budget: 100, prefOutfit })
const save = (girls = [girl()], day = 1): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold: 5000, day, guestPreference: '', marketPreference: '' },
  girls, currentDay: day, phase: 'morning', actionsUsedToday: 0, dailyGuests: [guest('制服')],
})

test('服装对口迎客 +6、穿错 −2；跳过的匹配加成仍是 +5，满意度整体 +2', () => {
  assert.equal(OUTFIT_GREET_BONUS, 6); assert.equal(OUTFIT_GREET_MISMATCH, -2)
  const g = girl({ skillRanks: { 待客: '初学' } })
  const run = (outfit: 'regular' | 'maid' | 'kimono') => resolveService({ girl: g, guest: guest('制服'), outfit, skip: true })
  assert.equal(run('maid').steps[0].score - run('regular').steps[0].score, 6)
  assert.equal(run('kimono').steps[0].score - run('regular').steps[0].score, -2)
  // 迎客单步仍封顶 14
  const top = girl({ skillRanks: { 待客: '精通' } })
  assert.equal(resolveService({ girl: top, guest: guest('制服'), outfit: 'maid', skip: true }).steps[0].score, 14)
})

test('热餐每人每天一次：同天第二份（任何恢复药）被拒，另一人不受影响，过一天恢复', () => {
  let s = save([girl(), girl({ id: 'b', name: 'B' })])
  for (const id of ['hot_meal', 'hot_meal', 'hot_meal', 'tonic_soup']) { const r = buyRecovery(s, id); assert.ok(r.ok); if (r.ok) s = r.save }
  assert.equal(recoveryUsedToday(s, s.girls[0]), false)
  const u = useRecovery(s, 'a', 'hot_meal'); assert.ok(u.ok); if (!u.ok) return
  s = u.save
  assert.equal(recoveryUsedToday(s, s.girls[0]), true)
  const again = useRecovery(s, 'a', 'hot_meal')
  assert.equal(again.ok, false); if (!again.ok) assert.match(again.error, /今天已经用过/)
  assert.equal(useRecovery(s, 'a', 'tonic_soup').ok, false)
  assert.equal(s.player.inventory!.hot_meal, 2) // 被拒时不扣背包
  const b = useRecovery(s, 'b', 'hot_meal'); assert.ok(b.ok); if (!b.ok) return
  s = endDay(b.save, () => 0.99)
  assert.equal(recoveryUsedToday(s, s.girls[0]), false)
  assert.ok(useRecovery(s, 'a', 'hot_meal').ok)
})

test('老存档没有 itemUsedOnDay：视为今天没用过，不需要额外迁移', () => {
  const s = migrateSave(save([girl()], 5))
  assert.equal(s.girls[0].itemUsedOnDay, undefined)
  assert.equal(recoveryUsedToday(s, s.girls[0]), false)
})
