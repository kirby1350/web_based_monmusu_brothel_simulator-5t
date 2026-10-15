// 30 天平衡模拟：只用纯逻辑（跳过结算，不调聊天），固定种子。用法：pnpm tsx scripts/sim-30days.ts [seed]
import type { GameSave, MonstGirl, SkillKey } from '../lib/types'
import { GIRL_TEMPLATES } from '../lib/game-data'
import { generateDailyGuests, getGuestCapacity, getGirlCapacity, getUpgradeCost, MAX_ACTIONS_PER_DAY } from '../lib/game-engine'
import { resolveService, canSkipService } from '../lib/resolve-service'
import { resolveTraining } from '../lib/resolve-training'
import { applyServiceToSave, applyTrainingToSave } from '../lib/settle-session'
import { endDay, upgradeDorm, getDormInfo } from '../lib/hub-logic'
import { withInitialProficiency, SERVING_PROF_SKILLS, PROF_TIERS } from '../lib/proficiency'
import { buyRecovery, useRecovery, upgradeServiceRoom, upgradeTrainingRoom, buyWardrobe } from '../lib/shop'
import { OUTFITS, STOCKINGS } from '../lib/catalog'
import type { OutfitId, StockingId } from '../lib/types'
import { migrateSave } from '../lib/migrate-save'
import { TRAINING_SCENES, sceneUnlocked, sceneReaction, sceneUpkeep, shadowScenes } from '../lib/scenes'
import { buyScene } from '../lib/shop'
import { setMachineNight } from '../lib/hub-logic'
import type { SceneId, TrainingDirection } from '../lib/types'

const seed = Number(process.argv[2] ?? 42)
/** 策略：base 只跳过；wardrobe 另买对口衣服并换装；train 每天先调教再接客；scenes = train + 买调教场景并使用、机械挂机；sscenes = train + 只买放权场景（女王调教室 / 王座间），服从够了就放权 */
const STRAT = (process.argv[3] ?? 'base') as 'base' | 'wardrobe' | 'train' | 'scenes' | 'sscenes'
const TRAINS = STRAT === 'train' || STRAT === 'scenes' || STRAT === 'sscenes'
const S_SCENES: SceneId[] = ['queen_room', 'throne']
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const rng = mulberry32(seed)
Math.random = rng // 游戏里的客人生成等都走 Math.random

const GIRL_PRICE = 300            // 市场价是 AI 生成的（缺省 200），这里固定 300
const RESERVE = 150               // 升级/买人后至少留的金币
const log: string[] = []
const out = (s: string) => { log.push(s); console.log(s) }

let tplIdx = 0
const newGirl = (): MonstGirl => withInitialProficiency({ ...(GIRL_TEMPLATES[tplIdx % GIRL_TEMPLATES.length] as MonstGirl), id: `g${tplIdx++}`, stamina: 100 })

let save: GameSave = migrateSave({
  player: { name: '馆主', traits: [], customTraits: '', fetishes: [], gold: Number(process.env.SIM_GOLD ?? 500), day: 1, guestPreference: '', marketPreference: '', level: 1, reputation: 0 },
  // 开局 2 人（UX 1）：SIM_START=1 可退回旧的 1 人开局
  girls: Array.from({ length: Number(process.env.SIM_START ?? 2) }, () => newGirl()), currentDay: 1, phase: 'morning', actionsUsedToday: 0,
  dailyGuests: generateDailyGuests(getGuestCapacity(1), 0, []), regulars: [],
})

const stats = { upkeep: 0, sceneUses: {} as Record<string, number>, awakenings: [] as string[], peakOb: [] as string[], punish: 0, sats: [] as number[], serviceIncome: 0, services: 0, trainings: 0, rests: 0, idle: 0, tiers: {} as Record<string, number>, upgrades: [] as string[], potions: 0, bought: 0, incomeByDay: [] as number[] }
const firstAffordable: Record<string, number | undefined> = {}

const DAYS = Number(process.env.SIM_DAYS ?? 30)
for (let day = 1; day <= DAYS; day++) {
  const goldStart = save.player.gold
  // sscenes：放权场景优先于设施（先补调教室到 Lv2 解锁女王调教室）
  if (STRAT === 'sscenes' && day >= 2) {
    if ((save.player.trainingRoomLevel ?? 1) < 2) { const r = upgradeTrainingRoom(save); if (r.ok && r.save.player.gold >= RESERVE) { save = r.save; stats.upgrades.push(`D${day} 调教室`) } }
    const sw = TRAINING_SCENES.filter((sc) => S_SCENES.includes(sc.id) && !(save.player.ownedScenes ?? []).includes(sc.id) && sceneUnlocked(save, sc.id) && save.player.gold - sc.price >= RESERVE)[0]
    if (sw) { const r = buyScene(save, sw.id); if (r.ok) { save = r.save; stats.upgrades.push(`D${day} 场景:${sw.name}`) } }
  }
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
  // 2a) 调教场景：先把常规升级做完（上面没花钱时），再按价格从低到高买已解锁的
  if ((STRAT === 'scenes' || STRAT === 'sscenes') && day >= 3) {
    const want = [...TRAINING_SCENES].filter((sc) => STRAT !== 'sscenes' || S_SCENES.includes(sc.id)).sort((a, b) => a.price - b.price)
      .find((sc) => !(save.player.ownedScenes ?? []).includes(sc.id) && sceneUnlocked(save, sc.id) && save.player.gold - sc.price >= RESERVE * 2)
    if (want) { const r = buyScene(save, want.id); if (r.ok) { save = r.save; stats.upgrades.push(`D${day} 场景:${want.name}`) } }
  }
  // 2b) 衣橱：今天客人里最多的服装喜好，没有就买
  if (STRAT === 'wardrobe' && day >= 3) {
    const prefs = (save.dailyGuests ?? []).map((g) => g.prefOutfit).filter(Boolean)
    const owned = new Set(save.player.wardrobe ?? [])
    const want = [...OUTFITS, ...STOCKINGS].find((o) => o.pref && prefs.includes(o.pref) && !owned.has(o.id) && save.player.gold - o.price >= RESERVE)
    if (want) { const r = buyWardrobe(save, want.id); if (r.ok) { save = r.save; stats.upgrades.push(`D${day} 衣:${want.name}`) } }
  }
  // 3) 行动
  for (let a = 0; a < MAX_ACTIONS_PER_DAY; a++) {
    // 体力低：先喂热餐（不占行动）
    for (const g of save.girls) {
      if ((g.stamina ?? 100) < 30 && g.itemUsedOnDay !== save.currentDay && save.player.gold > RESERVE + 40) {
        const b = buyRecovery(save, 'hot_meal'); if (b.ok) { const u = useRecovery(b.save, g.id, 'hot_meal'); if (u.ok) { save = u.save; stats.potions++ } }
      }
    }
    if (TRAINS && a === 0) {
      const t = [...save.girls].filter((g) => (g.stamina ?? 100) >= 60).sort((x, y) => x.obedience + x.lewdness - y.obedience - y.lewdness)[0]
      // 已入门、未到精通的服侍技能里挑最高的特训，否则驯服/放权
      const pv = (k: SkillKey) => t?.proficiency?.[k] ?? 0
      const sk = t && [...SERVING_PROF_SKILLS].filter((k) => pv(k) >= PROF_TIERS.初学 && pv(k) < PROF_TIERS.精通).sort((a, b) => pv(b) - pv(a))[0]
      if (t) {
        const sOwned = STRAT === 'sscenes' && (save.player.ownedScenes ?? []).some((id) => S_SCENES.includes(id))
        const dir: TrainingDirection = sOwned && t.obedience >= 40 ? 'release' : sk ? 'drill' : t.obedience <= t.lewdness ? 'tame' : 'release'
        const scene = pickScene(t, dir)
        const r = resolveTraining({ girl: t, direction: dir, skill: sk || undefined, skip: true, roomLevel: save.player.trainingRoomLevel, scene, day: save.currentDay })
        if (r.ok) { save = applyTrainingToSave(save, r, undefined, rng); stats.trainings++; noteScene(r, scene); continue }
      }
    }
    // 先处理事件、先把不能跳过的新人驯服到 25
    const urgent = save.girls.find((g) => (g.stamina ?? 100) >= 40 && (g.incident || !canSkipService(g)))
    if (urgent) {
      const udir: TrainingDirection = urgent.incident ? 'punish' : 'tame'
      const uscene = pickScene(urgent, udir)
      const r = resolveTraining({ girl: urgent, direction: udir, skip: true, roomLevel: save.player.trainingRoomLevel, scene: uscene, day: save.currentDay })
      if (r.ok) { save = applyTrainingToSave(save, r, undefined, rng); stats.trainings++; noteScene(r, uscene); if (urgent.incident) stats.punish++; continue }
    }
    const guests = save.dailyGuests ?? []
    let best: { g: MonstGirl; gi: number; sat: number; outfit: OutfitId; stockings: StockingId } | null = null
    for (const g of save.girls) {
      if ((g.stamina ?? 100) < 30 || !canSkipService(g)) continue
      guests.forEach((c, gi) => {
        for (const [outfit, stockings] of outfitCombos()) {
          const r = resolveService({ girl: g, guest: c, skip: true, roomLevel: save.player.serviceRoomLevel, sessionIndexToday: save.actionsUsedToday ?? 0, outfit, stockings })
          if (!best || r.satisfaction > best.sat) best = { g, gi, sat: r.satisfaction, outfit, stockings }
        }
      })
    }
    const b = best as { g: MonstGirl; gi: number; sat: number; outfit: OutfitId; stockings: StockingId } | null
    if (b && b.sat >= 35) {
      const guest = guests[b.gi]
      const r = resolveService({ girl: b.g, guest, skip: true, roomLevel: save.player.serviceRoomLevel, sessionIndexToday: save.actionsUsedToday ?? 0, outfit: b.outfit, stockings: b.stockings })
      save = applyServiceToSave(save, b.g.id, guest, r, rng).save
      stats.services++; stats.sats.push(r.satisfaction); stats.serviceIncome += r.reward; stats.tiers[r.tier.label] = (stats.tiers[r.tier.label] ?? 0) + 1
      continue
    }
    const trainee = [...save.girls].filter((g) => (g.stamina ?? 100) >= 40).sort((x, y) => x.obedience - y.obedience)[0]
    if (trainee) {
      const dir = trainee.obedience < 60 ? 'tame' : 'release'
      const tscene = pickScene(trainee, dir)
      const r = resolveTraining({ girl: trainee, direction: dir, skip: true, roomLevel: save.player.trainingRoomLevel, scene: tscene, day: save.currentDay })
      if (r.ok) { save = applyTrainingToSave(save, r, undefined, rng); stats.trainings++; noteScene(r, tscene); continue }
    }
    // 没有值得做的事：把剩下的行动留着，结束今天时变成全员休养（UX 6）
    stats.rests += MAX_ACTIONS_PER_DAY - a
    break
  }
  const avgSt = Math.round(save.girls.reduce((s, g) => s + (g.stamina ?? 100), 0) / save.girls.length)
  // 机械挂机：今天没出场、服从最低的那位
  if (STRAT === 'scenes' && (save.player.ownedScenes ?? []).includes('machine')) {
    const idle = save.girls.filter((g) => !(save.appearedToday ?? []).includes(g.id)).sort((x, y) => x.obedience - y.obedience)[0]
    if (idle) { const r = setMachineNight(save, idle.id); if (r.ok) { save = r.save; stats.sceneUses['机械挂机'] = (stats.sceneUses['机械挂机'] ?? 0) + 1 } }
  }
  stats.upkeep += Math.min(sceneUpkeep(save.player), save.player.gold)
  out(`D${String(day).padStart(2)} 金 ${String(save.player.gold).padStart(5)} (${save.player.gold - goldStart >= 0 ? '+' : ''}${save.player.gold - goldStart}) 声望 ${save.player.reputation ?? 0} 均体力 ${avgSt} ` +
    `设施 馆${save.player.level}/宿${save.player.dormLevel}/服${save.player.serviceRoomLevel}/调${save.player.trainingRoomLevel} 人 ${save.girls.length} ` +
    `| ${save.girls.map((g) => `${g.name}[体${g.stamina} 服${g.obedience} 淫${g.lewdness} 好${g.affection}${g.incident ? ' !' : ''}${g.awakened?.length ? ' ✦' + g.awakened.length : ''}${shadowScenes(g).length ? ' 影' : ''}]`).join(' ')}`)
  save = endDay(save, rng)
  stats.incomeByDay.push(save.player.gold - goldStart)  // 含当晚维护费
}

/** 场景策略：好感 <35 有温泉就温泉；否则选对口、非抗拒、服从/淫乱加成最大的 */
function pickScene(g: MonstGirl, dir: TrainingDirection): SceneId | undefined {
  if (STRAT !== 'scenes' && STRAT !== 'sscenes') return undefined
  const owned = TRAINING_SCENES.filter((sc) => (save.player.ownedScenes ?? []).includes(sc.id) && sc.directions.includes(dir))
  if (!owned.length) return undefined
  if (g.affection < 35 && owned.some((sc) => sc.id === 'onsen')) return 'onsen'
  const ok = owned.filter((sc) => sc.id !== 'onsen' && sceneReaction(g, sc.id) !== 'aversion')
  let best: { id: SceneId; v: number } | undefined
  for (const sc of ok) {
    const r = resolveTraining({ girl: g, direction: dir, skip: true, roomLevel: save.player.trainingRoomLevel, scene: sc.id, day: save.currentDay })
    const v = r.ok ? r.delta.obedience + r.delta.lewdness + r.delta.skillProgress / 2 + r.delta.sensitivity + (STRAT === 'sscenes' ? (r.delta.s ?? 0) : 0) : -1
    if (!best || v > best.v) best = { id: sc.id, v }
  }
  return best?.id
}
function noteScene(r: ReturnType<typeof resolveTraining>, scene?: SceneId) {
  if (!scene) return
  const name = TRAINING_SCENES.find((s) => s.id === scene)!.name
  stats.sceneUses[name] = (stats.sceneUses[name] ?? 0) + 1
  if (r.awakenedScene) stats.awakenings.push(`D${save.currentDay} ${r.girl.name}:${TRAINING_SCENES.find((s) => s.id === r.awakenedScene)!.fetish}`)
}

function outfitCombos(): [OutfitId, StockingId][] {
  const owned = new Set(save.player.wardrobe ?? [])
  const os = OUTFITS.filter((o) => o.id === 'regular' || owned.has(o.id)).map((o) => o.id)
  const ss = STOCKINGS.filter((x) => x.id === 'none' || owned.has(x.id)).map((x) => x.id)
  return os.flatMap((o) => ss.map((x) => [o, x] as [OutfitId, StockingId]))
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
out(`策略 ${STRAT}｜种子 ${seed}｜接客 ${stats.services}，调教 ${stats.trainings}，休养（留空行动）${stats.rests}，闲置 ${stats.idle}，热餐 ${stats.potions}，买人 ${stats.bought}`)
out(`评价分布 ${JSON.stringify(stats.tiers)}｜满意度 最低 ${Math.min(...stats.sats)} 平均 ${Math.round(stats.sats.reduce((a, b) => a + b, 0) / stats.sats.length)} 最高 ${Math.max(...stats.sats)}｜接客总收入 ${stats.serviceIncome}，惩罚 ${stats.punish}`)
out(`回头客 ${(save.regulars ?? []).length}，最终声望 ${save.player.reputation ?? 0}，最终金币 ${save.player.gold}`)
out(`升级记录 ${stats.upgrades.join('，') || '无'}`)
out(`首次买得起 ${JSON.stringify(firstAffordable)}`)
out(`场景维护费合计 ${stats.upkeep}｜场景使用 ${JSON.stringify(stats.sceneUses)}｜觉醒 ${stats.awakenings.join('，') || '无'}｜阴影 ${save.girls.filter((g) => shadowScenes(g).length).map((g) => g.name).join('、') || '无'}`)
out(`最终技能 ${save.girls.map((g) => `${g.name}[${Object.entries(g.proficiency ?? {}).map(([k, v]) => `${k}${Math.floor(v as number)}`).join(' ')} ${g.inclination}]`).join(' ')}`)
out(`最终服从 ${save.girls.map((g) => `${g.name}${g.obedience}`).join(' ')}｜平均好感 ${Math.round(save.girls.reduce((a, g) => a + g.affection, 0) / save.girls.length)}`)
const inc = stats.incomeByDay
out(`日净收入：前 10 天均 ${Math.round(inc.slice(0, 10).reduce((a, b) => a + b, 0) / 10)}，后 10 天均 ${Math.round(inc.slice(-10).reduce((a, b) => a + b, 0) / 10)}`)
require('node:fs').writeFileSync(process.env.SIM_OUT ?? '/workspace/sim-30days.txt', log.join('\n') + '\n')
