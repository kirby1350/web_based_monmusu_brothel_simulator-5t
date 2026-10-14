import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GameSave, Guest, MonstGirl } from './types'
import {
  buyRecovery, buySculpt, buyWardrobe, buyTrainingProp, useRecovery, upgradeServiceRoom, upgradeTrainingRoom,
  sculptPrice, vigorOnShelf, shelfRecoveryItems,
} from './shop'
import { resolveService } from './resolve-service'
import { previewService } from './settle-session'

const girl = (o: Partial<MonstGirl> = {}): MonstGirl => ({
  id: 'a', name: 'A', race: '猫娘', age: '', bodyDesc: '', bodyTags: '', bust: 85, waist: 62, hip: 88,
  personality: '', personalityTags: '', outfit: '', outfitTags: '', otherDesc: '', otherTags: '',
  affection: 20, obedience: 40, lewdness: 40, skills: [], imageTags: '', stamina: 20, ...o,
})
const guest: Guest = { id: 'c', name: 'C', race: '人类', personality: '', traits: [], desires: '想把高傲的魔物娘彻底操服', imageTags: '', satisfaction: 0, budget: 100, prefOutfit: '制服' }
const save = (gold = 5000, girls = [girl()]): GameSave => ({
  player: { name: 'p', traits: [], customTraits: '', fetishes: [], gold, day: 1, guestPreference: '', marketPreference: '' },
  girls, currentDay: 1, phase: 'morning', actionsUsedToday: 0, dailyGuests: [guest],
})

test('买女仆装：扣钱进衣橱，不能重复买；客人喜好制服时迎客 +4', () => {
  const r = buyWardrobe(save(), 'maid'); assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.player.gold, 4800)
  assert.deepEqual(r.save.player.wardrobe, ['maid'])
  assert.equal(buyWardrobe(r.save, 'maid').ok, false)
  assert.equal(buyWardrobe(save(), 'regular').ok, false)
  const g = girl()
  const regular = resolveService({ girl: g, guest, outfit: 'regular', skip: true }).steps[0].score
  const maid = resolveService({ girl: g, guest, outfit: 'maid', skip: true }).steps[0].score
  assert.equal(maid - regular, 4)
})

test('服务房间 500/1000/1800；升到 2 级后跳过预览自动填 1 个 play', () => {
  let s = save(); let r = upgradeServiceRoom(s); assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.player.gold, 4500); assert.equal(r.save.player.serviceRoomLevel, 2)
  const g = girl({ skillRanks: { 口侍: '初学', 手技: '初学' } })
  assert.equal(previewService({ girl: g, guest, roomLevel: 1 }).skip.plays.length, 0)
  assert.equal(previewService({ girl: g, guest, roomLevel: 2 }).skip.plays.length, 1)
  s = r.save
  r = upgradeServiceRoom(s); if (!r.ok) return assert.fail(); r = upgradeServiceRoom(r.save); if (!r.ok) return assert.fail()
  assert.equal(r.save.player.gold, 5000 - 500 - 1000 - 1800)
  assert.equal(upgradeServiceRoom(r.save).ok, false)
})

test('调教室 500/1000/1800，金币不足拒绝', () => {
  const r = upgradeTrainingRoom(save()); assert.ok(r.ok); if (!r.ok) return
  assert.equal(r.save.player.trainingRoomLevel, 2)
  assert.equal(upgradeTrainingRoom(save(100)).ok, false)
})

test('恢复药：进背包，每人每天一瓶，热餐 +30，魔女效果 ×1.5', () => {
  let r = buyRecovery(save(), 'hot_meal'); if (!r.ok) return assert.fail()
  r = buyRecovery(r.save, 'hot_meal'); if (!r.ok) return assert.fail()
  assert.equal(r.save.player.gold, 4920); assert.equal(r.save.player.inventory!.hot_meal, 2)
  const u = useRecovery(r.save, 'a', 'hot_meal'); if (!u.ok) return assert.fail()
  assert.equal(u.save.girls[0].stamina, 50); assert.equal(u.save.player.inventory!.hot_meal, 1)
  assert.equal(useRecovery(u.save, 'a', 'hot_meal').ok, false)
  const w = save(5000, [girl({ race: '魔女' })]); w.player.inventory = { hot_meal: 1 }
  const wu = useRecovery(w, 'a', 'hot_meal'); if (!wu.ok) return assert.fail()
  assert.equal(wu.save.girls[0].stamina, 65)
})

test('精力药约三成天数上架，同一天结果固定', () => {
  let n = 0; for (let d = 1; d <= 1000; d++) if (vigorOnShelf(d)) n++
  assert.ok(n > 200 && n < 400, `got ${n}`)
  assert.equal(vigorOnShelf(7), vigorOnShelf(7))
  const day = [...Array(100).keys()].find((d) => !vigorOnShelf(d))!
  const s = { ...save(), currentDay: day }
  assert.equal(shelfRecoveryItems(day).some((i) => i.id === 'vigor_potion'), false)
  assert.equal(buyRecovery(s, 'vigor_potion').ok, false)
})

test('塑形药起步 180，该项每改过一次再贵 80；进背包', () => {
  assert.equal(sculptPrice(save(), 'bust'), 180)
  assert.equal(sculptPrice(save(5000, [girl({ sculptCounts: { bust: 2, waist: 0, hip: 0 } })]), 'bust'), 340)
  const r = buySculpt(save(), 'bust_up'); if (!r.ok) return assert.fail()
  assert.equal(r.save.player.inventory!.bust_up, 1); assert.equal(r.save.player.gold, 4820)
})

test('调教道具买一次永久拥有', () => {
  const r = buyTrainingProp(save(), 'mirror'); if (!r.ok) return assert.fail()
  assert.deepEqual(r.save.player.ownedTrainingProps, ['mirror'])
  assert.equal(buyTrainingProp(r.save, 'mirror').ok, false)
})
