// 30 天平衡模拟：只用纯逻辑（跳过结算，不调聊天），固定种子。用法：pnpm tsx scripts/sim-30days.ts [seed]
import type { GameSave, MonstGirl, SkillKey } from '../lib/types'
import { GIRL_TEMPLATES } from '../lib/game-data'
import { generateDailyGuests, getGuestCapacity, getGirlCapacity, getUpgradeCost, MAX_ACTIONS_PER_DAY } from '../lib/game-engine'
import { resolveService, canSkipService } from '../lib/resolve-service'
import { resolveTraining } from '../lib/resolve-training'
import { applyServiceToSave, applyTrainingToSave } from '../lib/settle-session'
import { endDay, restGirl, upgradeDorm, getDormInfo, pendingSkillPicks, pickSkill, selectableSkills } from '../lib/hub-logic'
import { buyRecovery, useRecovery, upgradeServiceRoom, upgradeTrainingRoom } from '../lib/shop'
import { migrateSave } from '../lib/migrate-save'

const seed = Number(process.argv[2] ?? 42)
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const rng = mulberry32(seed)
Math.random = rng // 游戏里的客人生成等都走 Math.random

const GIRL_PRICE = 300            // 市场价是 AI 生成的（缺省 200），这里固定 300
const RESERVE = 150               // 升级/买人后至少留的金币
const SKILL_ORDER: SkillKey[] = ['身侍', '口侍', '待客', '手技', '胸侍', 'M性', 'S性']
const log: string[] = []
const out = (s: string) => { log.push(s); console.log(s) }

let tplIdx = 0
const newGirl = (): MonstGirl => ({ ...(GIRL_TEMPLATES[tplIdx % GIRL_TEMPLATES.length] as MonstGirl), id: `g${tplIdx++}`, stamina: 100 })

let save: GameSave = migrateSave({
  player: { name: '馆主', traits: [], customTraits: '', fetishes: [], gold: 500, day: 1, guestPreference: '', marketPreference: '', level: 1, reputation: 0 },
  girls: [newGirl()], currentDay: 1, phase: 'morning', actionsUsedToday: 0,
  dailyGuests: generateDailyGuests(getGuestCapacity(1), 0, []), regulars: [],
})

const stats = { punish: 0, sats: [] as number[], serviceIncome: 0, services: 0, trainings: 0, rests: 0, idle: 0, tiers: {} as Record<string, number>, upgrades: [] as string[], potions: 0, bought: 0, incomeByDay: [] as number[] }
const firstAffordable: Record<string, number | undefined> = {}

for (let day = 1; day <= 30; day++) {
  const goldStart = save.player.gold
  // 1) 技能选择
  save = { ...save, girls: save.girls.map((g) => {
    let x = g
    while (pendingSkillPicks(x) > 0) { const k = SKILL_ORDER.find((s) => selectableSkills(x).includes(s)); const n = k && pickSkill(x, k); if (!n) break; x = n }
    return x
  }) }
  // 2) 升级 / 买人（每天最多一次，按优先级）
  const tryUp = (label: string, cost: number | null, f: () => void) => {
    if (cost === null) return false
    if (firstAffordable[label] === undefined && save.player.gold >= cost) firstAffordable[label] = day
    if (save.player.gold - cost < RESERVE) return false
    f(); stats.upgrades.push(`D${day} ${label}`); return true
  }
  const lv = save.player.level ?? 1
  const svcCost = [300, 700, 1300][(save.player.serviceRoomLevel ?? 1) - 1] ?? null
  void svcCost
  ;(save.girls.length < getGirlCapacity(lv) && tryUp('买人', GIRL_PRICE, () => { save = { ...save, player: { ...save.player, gold: save.player.gold - GIRL_PRICE }, girls: [...save.girls, newGirl()] }; stats.bought++ }))
    || tryUp('服务房间', peekCost(() => upgradeServiceRoom(save)), () => { const r = upgradeServiceRoom(save); if (r.ok) save = r.save })
    || tryUp('宿舍', getDormInfo(save.player.dormLevel).upgradeCost, () => { const r = upgradeDorm(save); if (r.ok) save = r.save })
    || (save.girls.length >= getGirlCapacity(lv) && tryUp('娼馆', getUpgradeCost(lv), () => { save = { ...save, player: { ...save.player, gold: save.player.gold - getUpgradeCost(lv), level: lv + 1 } } }))
    || tryUp('调教室', peekCost(() => upgradeTrainingRoom(save)), () => { const r = upgradeTrainingRoom(save); if (r.ok) save = r.save })
  // 3) 行动
  for (let a = 0; a < MAX_ACTIONS_PER_DAY; a++) {
    // 体力低：先喂热餐（不占行动）
    for (const g of save.girls) {
      if ((g.stamina ?? 100) < 30 && g.itemUsedOnDay !== save.currentDay && save.player.gold > RESERVE + 40) {
        const b = buyRecovery(save, 'hot_meal'); if (b.ok) { const u = useRecovery(b.save, g.id, 'hot_meal'); if (u.ok) { save = u.save; stats.potions++ } }
      }
    }
    // 先处理事件、先把不能跳过的新人驯服到 25
    const urgent = save.girls.find((g) => (g.stamina ?? 100) >= 40 && (g.incident || !canSkipService(g)))
    if (urgent) {
      const r = resolveTraining({ girl: urgent, direction: urgent.incident ? 'punish' : 'tame', skip: true, roomLevel: save.player.trainingRoomLevel })
      if (r.ok) { save = applyTrainingToSave(save, r); stats.trainings++; if (urgent.incident) stats.punish++; continue }
    }
    const guests = save.dailyGuests ?? []
    let best: { g: MonstGirl; gi: number; sat: number } | null = null
    for (const g of save.girls) {
      if ((g.stamina ?? 100) < 30 || !canSkipService(g)) continue
      guests.forEach((c, gi) => {
        const r = resolveService({ girl: g, guest: c, skip: true, roomLevel: save.player.serviceRoomLevel, sessionIndexToday: save.actionsUsedToday ?? 0 })
        if (!best || r.satisfaction > best.sat) best = { g, gi, sat: r.satisfaction }
      })
    }
    const b = best as { g: MonstGirl; gi: number; sat: number } | null
    if (b && b.sat >= 35) {
      const guest = guests[b.gi]
      const r = resolveService({ girl: b.g, guest, skip: true, roomLevel: save.player.serviceRoomLevel, sessionIndexToday: save.actionsUsedToday ?? 0 })
      save = applyServiceToSave(save, b.g.id, guest, r, rng).save
      stats.services++; stats.sats.push(r.satisfaction); stats.serviceIncome += r.reward; stats.tiers[r.tier.label] = (stats.tiers[r.tier.label] ?? 0) + 1
      continue
    }
    const trainee = [...save.girls].filter((g) => (g.stamina ?? 100) >= 40).sort((x, y) => x.obedience - y.obedience)[0]
    if (trainee) {
      const dir = trainee.obedience < 60 ? 'tame' : 'release'
      const r = resolveTraining({ girl: trainee, direction: dir, skip: true, roomLevel: save.player.trainingRoomLevel })
      if (r.ok) { save = applyTrainingToSave(save, r); stats.trainings++; continue }
    }
    const tired = [...save.girls].sort((x, y) => (x.stamina ?? 100) - (y.stamina ?? 100))[0]
    const rr = restGirl(save, tired.id)
    if (rr.ok) { save = rr.save; stats.rests++ } else stats.idle++
  }
  const avgSt = Math.round(save.girls.reduce((s, g) => s + (g.stamina ?? 100), 0) / save.girls.length)
  stats.incomeByDay.push(save.player.gold - goldStart)
  out(`D${String(day).padStart(2)} 金 ${String(save.player.gold).padStart(5)} (${save.player.gold - goldStart >= 0 ? '+' : ''}${save.player.gold - goldStart}) 声望 ${save.player.reputation ?? 0} 均体力 ${avgSt} ` +
    `设施 馆${save.player.level}/宿${save.player.dormLevel}/服${save.player.serviceRoomLevel}/调${save.player.trainingRoomLevel} 人 ${save.girls.length} ` +
    `| ${save.girls.map((g) => `${g.name}[体${g.stamina} 服${g.obedience} 淫${g.lewdness} 好${g.affection}${g.incident ? ' !' : ''}]`).join(' ')}`)
  save = endDay(save, rng)
}

function peekCost(f: () => { ok: boolean } & ({ ok: true } | { ok: false; error: string })): number | null {
  // 用十万金币试升级，拿到花费；满级返回 null
  const rich = { ...save, player: { ...save.player, gold: 100000 } }
  const saved = save; save = rich
  const r = f() as { ok: boolean; save?: GameSave }
  save = saved
  return r.ok && r.save ? 100000 - r.save.player.gold : null
}

out('')
out(`种子 ${seed}｜接客 ${stats.services}，调教 ${stats.trainings}，休息 ${stats.rests}，闲置 ${stats.idle}，热餐 ${stats.potions}，买人 ${stats.bought}`)
out(`评价分布 ${JSON.stringify(stats.tiers)}｜满意度 最低 ${Math.min(...stats.sats)} 平均 ${Math.round(stats.sats.reduce((a, b) => a + b, 0) / stats.sats.length)} 最高 ${Math.max(...stats.sats)}｜接客总收入 ${stats.serviceIncome}，惩罚 ${stats.punish}`)
out(`升级记录 ${stats.upgrades.join('，') || '无'}`)
out(`首次买得起 ${JSON.stringify(firstAffordable)}`)
const inc = stats.incomeByDay
out(`日净收入：前 10 天均 ${Math.round(inc.slice(0, 10).reduce((a, b) => a + b, 0) / 10)}，后 10 天均 ${Math.round(inc.slice(20).reduce((a, b) => a + b, 0) / 10)}`)
require('node:fs').writeFileSync('/workspace/sim-30days.txt', log.join('\n') + '\n')
