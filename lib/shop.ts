// 商店与设施（纯函数）：恢复药、塑形药、衣橱、调教道具；服务房间 / 调教室升级
import type { GameSave, MonstGirl, SceneId } from './types'
import { getScene, sceneUnlocked, unlockText } from './scenes'
import {
  RECOVERY_ITEMS, SCULPT_POTIONS, OUTFITS, STOCKINGS, TRAINING_PROPS, MAX_STAMINA,
  SCULPT_BASE_PRICE, SCULPT_PRICE_STEP, SERVICE_ROOM_UPGRADE_COSTS, TRAINING_ROOM_UPGRADE_COSTS, getUpgradeCostFor,
  type SculptStat,
} from './catalog'

export type ShopResult = { ok: true; save: GameSave; message: string } | { ok: false; error: string }
const fail = (error: string): ShopResult => ({ ok: false, error })

/** 魔女「调剂」：她使用的恢复药与塑形药效果提高五成 */
export const WITCH_ITEM_MULT = 1.5
export const itemMult = (girl: Pick<MonstGirl, 'race'>) => (girl.race === '魔女' ? WITCH_ITEM_MULT : 1)

// ─── 货架：恢复药全部常驻（精力药不再按天随机） ───────────────────────────────

export function shelfRecoveryItems(_day?: number) {
  return RECOVERY_ITEMS
}

// ─── 塑形药价格：起步 180G，该项（全馆）每改过一次再贵 80G ────────────────────

export function sculptPrice(save: GameSave, stat: SculptStat): number {
  const done = save.girls.reduce((a, g) => a + (g.sculptCounts?.[stat] ?? 0), 0)
  return SCULPT_BASE_PRICE + SCULPT_PRICE_STEP * done
}

// ─── 购买 ─────────────────────────────────────────────────────────────────────

const spend = (save: GameSave, cost: number, patch: Partial<GameSave['player']>): GameSave =>
  ({ ...save, player: { ...save.player, ...patch, gold: save.player.gold - cost } })

const addInv = (save: GameSave, id: string) => {
  const inv = { ...(save.player.inventory ?? {}) }
  inv[id] = (inv[id] ?? 0) + 1
  return inv
}

export function buyRecovery(save: GameSave, id: string): ShopResult {
  const item = shelfRecoveryItems(save.currentDay).find((i) => i.id === id)
  if (!item) return fail('今天货架上没有这件商品')
  if (save.player.gold < item.price) return fail('金币不足')
  return { ok: true, message: `买下了「${item.name}」，已放入背包`, save: spend(save, item.price, { inventory: addInv(save, id) }) }
}

export function buySculpt(save: GameSave, id: string): ShopResult {
  const potion = SCULPT_POTIONS.find((p) => p.id === id)
  if (!potion) return fail('无效商品')
  const price = sculptPrice(save, potion.stat)
  if (save.player.gold < price) return fail('金币不足')
  return { ok: true, message: `买下了「${potion.name}」，只能在调教里使用`, save: spend(save, price, { inventory: addInv(save, id) }) }
}

export function buyWardrobe(save: GameSave, id: string): ShopResult {
  const item = [...OUTFITS, ...STOCKINGS].find((o) => o.id === id && o.price > 0)
  if (!item) return fail('无效商品')
  const owned = save.player.wardrobe ?? []
  if (owned.includes(id)) return fail('衣橱里已经有了')
  if (save.player.gold < item.price) return fail('金币不足')
  return { ok: true, message: `「${item.name}」放进了衣橱，全馆都能穿`, save: spend(save, item.price, { wardrobe: [...owned, id] }) }
}

export function buyTrainingProp(save: GameSave, id: string): ShopResult {
  const prop = TRAINING_PROPS.find((p) => p.id === id)
  if (!prop) return fail('无效商品')
  const owned = save.player.ownedTrainingProps ?? []
  if (owned.includes(id)) return fail('已经拥有')
  if (save.player.gold < prop.price) return fail('金币不足')
  return { ok: true, message: `买下了「${prop.name}」，调教时可选`, save: spend(save, prop.price, { ownedTrainingProps: [...owned, id] }) }
}

export function buyScene(save: GameSave, id: SceneId): ShopResult {
  const def = getScene(id)
  if (!def) return fail('无效商品')
  const owned = save.player.ownedScenes ?? []
  if (owned.includes(id)) return fail('已经拥有')
  if (!sceneUnlocked(save, id)) return fail(`尚未解锁：需要${unlockText(def.unlock)}`)
  if (save.player.gold < def.price) return fail('金币不足')
  return { ok: true, message: `建好了「${def.name}」，调教时可选；每天维护 ${def.upkeep}G`, save: spend(save, def.price, { ownedScenes: [...owned, id] }) }
}

// ─── 使用恢复药：不占行动，每人每天一瓶 ────────────────────────────────────────

/** 她今天是否已经用过恢复药（热餐/滋补汤/精力药共用每人每天一次的额度，过一天自动重置） */
export const recoveryUsedToday = (save: Pick<GameSave, 'currentDay'>, girl: Pick<MonstGirl, 'itemUsedOnDay'>) =>
  girl.itemUsedOnDay === save.currentDay

export function useRecovery(save: GameSave, girlId: string, id: string): ShopResult {
  const item = RECOVERY_ITEMS.find((i) => i.id === id)
  const girl = save.girls.find((g) => g.id === girlId)
  if (!item || !girl) return fail('无效道具或魔物娘')
  if ((save.player.inventory?.[id] ?? 0) <= 0) return fail('背包里没有这件道具')
  if (recoveryUsedToday(save, girl)) return fail(`${girl.name} 今天已经用过恢复药了`)
  const before = girl.stamina ?? MAX_STAMINA
  const after = item.stamina === 'full' ? MAX_STAMINA : Math.min(MAX_STAMINA, before + Math.round(item.stamina * itemMult(girl)))
  const inv = { ...(save.player.inventory ?? {}) }
  inv[id] -= 1
  if (inv[id] <= 0) delete inv[id]
  return {
    ok: true,
    message: `${girl.name} 用了「${item.name}」，体力 ${before} → ${after}`,
    save: {
      ...save,
      player: { ...save.player, inventory: inv },
      girls: save.girls.map((g) => g.id !== girlId ? g : {
        ...g, stamina: after, itemUsedOnDay: save.currentDay, exhausted: item.clearsExhaustion ? false : g.exhausted,
      }),
    },
  }
}

// ─── 设施升级 ─────────────────────────────────────────────────────────────────

function upgrade(save: GameSave, key: 'serviceRoomLevel' | 'trainingRoomLevel', table: number[], label: string): ShopResult {
  const lv = save.player[key] ?? 1
  const cost = getUpgradeCostFor(table, lv)
  if (cost === null) return fail(`${label}已满级`)
  if (save.player.gold < cost) return fail('金币不足')
  return { ok: true, message: `${label}升到 ${lv + 1} 级`, save: spend(save, cost, { [key]: lv + 1 }) }
}

export const upgradeServiceRoom = (save: GameSave) => upgrade(save, 'serviceRoomLevel', SERVICE_ROOM_UPGRADE_COSTS, '服务房间')
export const upgradeTrainingRoom = (save: GameSave) => upgrade(save, 'trainingRoomLevel', TRAINING_ROOM_UPGRADE_COSTS, '调教室')
