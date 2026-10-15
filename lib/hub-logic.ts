import { buildDaySummary, freshDayLog } from './day-summary'
// 大厅经营动作（纯函数）：送礼、宿舍升级、结束今天（含休养）
import type { GameSave, Guest, MonstGirl, SkillKey } from './types'
import {
  DORM_LEVELS, DORM_UPGRADE_COSTS, MAX_STAMINA, IDLE_REST_BONUS, UNUSED_ACTION_REST_BONUS,
  getUpgradeCostFor, getPlaySlots, TRAINING_ROOM_MULT, TRAINING_ROOM_PROP_SLOTS,
} from './catalog'
import { nightlyIncidents } from './incidents'
import { MAX_ACTIONS_PER_DAY, getGuestCapacity, getGirlCapacity } from './game-engine'
import { nextDayGuests } from './guest-gen'
import { speechLine } from './speech-style'
import { compactMemory, giftAffection, recordGift, addEvent } from './girl-memory'
import { accumulateScene, ownsScene, sceneUpkeep, MACHINE_NIGHT_OBEDIENCE } from './scenes'

export type HubResult = { ok: true; save: GameSave; message: string } | { ok: false; error: string }

const replaceGirl = (save: GameSave, g: MonstGirl): MonstGirl[] => save.girls.map((x) => (x.id === g.id ? g : x))
const clampStamina = (n: number) => Math.max(0, Math.min(MAX_STAMINA, n))

// ─── 送礼：全馆每天一次，当场扣钱 ──────────────────────────────────────────────

export const GIFT_OPTIONS = [
  { name: '小礼物', cost: 20, affectionBonus: 5 },
  { name: '精美首饰', cost: 80, affectionBonus: 15 },
  { name: '稀有宝石', cost: 200, affectionBonus: 30 },
]

export function canGiveGiftToday(save: GameSave): boolean {
  return save.player.giftGivenOnDay !== save.currentDay
}

export function giveGift(save: GameSave, girlId: string, giftIndex: number): HubResult {
  const gift = GIFT_OPTIONS[giftIndex]
  const girl = save.girls.find((g) => g.id === girlId)
  if (!gift || !girl) return { ok: false, error: '无效的礼物或魔物娘' }
  if (!canGiveGiftToday(save)) return { ok: false, error: '今天已经送过礼了（全馆每天一次）' }
  if (save.player.gold < gift.cost) return { ok: false, error: '金币不足' }
  const aff = giftAffection(girl, giftIndex, gift.affectionBonus, save.currentDay)
  const updated = recordGift({ ...girl, affection: Math.min(100, girl.affection + aff.value) }, giftIndex, gift.name, save.currentDay)
  return {
    ok: true,
    message: `送出了「${gift.name}」！${girl.name} 的好感度 +${aff.value}${aff.note ? `（${aff.note}）` : ''}`,
    save: {
      ...save,
      player: { ...save.player, gold: save.player.gold - gift.cost, giftGivenOnDay: save.currentDay },
      girls: replaceGirl(save, updated),
    },
  }
}


// ─── 宿舍 ─────────────────────────────────────────────────────────────────────

export function getDormInfo(level?: number) {
  const lv = Math.max(1, Math.min(DORM_LEVELS.length, level ?? 1))
  return { level: lv, ...DORM_LEVELS[lv - 1], upgradeCost: getUpgradeCostFor(DORM_UPGRADE_COSTS, lv) }
}

export function upgradeDorm(save: GameSave): HubResult {
  const { level, upgradeCost } = getDormInfo(save.player.dormLevel)
  if (upgradeCost === null) return { ok: false, error: '宿舍已满级' }
  if (save.player.gold < upgradeCost) return { ok: false, error: '金币不足' }
  const next = getDormInfo(level + 1)
  return {
    ok: true,
    message: `宿舍升级为「${next.name}」`,
    save: { ...save, player: { ...save.player, gold: save.player.gold - upgradeCost, dormLevel: level + 1 } },
  }
}

/** 宿舍夜间回复量（单间指定的那一人再 +15） */
export function nightlyRecovery(save: GameSave, girl: MonstGirl): number {
  const dorm = getDormInfo(save.player.dormLevel)
  return dorm.nightly + (dorm.bestBedBonus && save.bestBedGirlId === girl.id ? dorm.bestBedBonus : 0)
}

// ─── 结束今天：宿舍回复、行动归零、刷新客人池 ─────────────────────────────────

/** 一个人今晚的恢复明细（结束今天的预览与结算共用） */
export interface NightRest {
  girlId: string; name: string; before: number; after: number
  dorm: number; bestBed: number; idle: number; unused: number
  /** 机械挂机：宿舍恢复减半、不吃休养加成 */
  machine: boolean
  clearsExhaustion: boolean
}

/** 今天还剩几次行动没用（每次 = 全员休养 +15） */
export function unusedActions(save: GameSave): number {
  return Math.max(0, MAX_ACTIONS_PER_DAY - (save.actionsUsedToday ?? 0))
}

/**
 * 结束今天的恢复：宿舍每晚恢复（单间床位另加）+ 休养加成。
 * - 今天没出场：+15，并解除疲惫；
 * - 每剩 1 次没用的行动：全员 +15（最多 3 次）；
 * - 机械挂机的人：宿舍恢复减半，不吃休养加成。
 */
export function nightPlan(save: GameSave): NightRest[] {
  const dormInfo = getDormInfo(save.player.dormLevel)
  const nightId = machineNightTarget(save)
  const unused = unusedActions(save) * UNUSED_ACTION_REST_BONUS
  const appeared = save.appearedToday ?? []
  return save.girls.map((g) => {
    const before = g.stamina ?? MAX_STAMINA
    const bestBed = dormInfo.bestBedBonus && save.bestBedGirlId === g.id ? dormInfo.bestBedBonus : 0
    if (g.id === nightId) {
      const dorm = Math.floor((dormInfo.nightly + bestBed) / 2)
      return { girlId: g.id, name: g.name, before, after: clampStamina(before + dorm), dorm, bestBed: 0, idle: 0, unused: 0, machine: true, clearsExhaustion: !!dormInfo.clearsExhaustion }
    }
    const idle = appeared.includes(g.id) ? 0 : IDLE_REST_BONUS
    const total = dormInfo.nightly + bestBed + idle + unused
    return {
      girlId: g.id, name: g.name, before, after: clampStamina(before + total), dorm: dormInfo.nightly, bestBed, idle, unused, machine: false,
      clearsExhaustion: !!dormInfo.clearsExhaustion || idle > 0,
    }
  })
}

export function endDay(save: GameSave, rng: () => number = Math.random): GameSave {
  // 机械调教室夜间挂机：今天没出场的那一人，服从 +3、当晚体力恢复减半、记一次场景使用
  const nightId = machineNightTarget(save)
  let nightNote: string | undefined
  const plan = nightPlan(save)
  const rested = save.girls.map((g, i) => {
    const p = plan[i]
    const base = { ...g, exhausted: p.clearsExhaustion ? false : g.exhausted }
    if (g.id !== nightId) return { ...base, stamina: p.after }
    const hooked = { ...base, stamina: p.after, obedience: Math.min(100, g.obedience + MACHINE_NIGHT_OBEDIENCE) }
    const acc = accumulateScene(hooked, 'machine', save.currentDay)
    nightNote = `${g.name}在机械调教室挂了一夜：服从 +${MACHINE_NIGHT_OBEDIENCE}${acc.awakenedNow ? '，觉醒了器具癖' : ''}`
    let after = g.memory ? addEvent(acc.girl, { day: save.currentDay, kind: 'training', text: '在机械调教室里被挂了一整夜', w: 1, scene: 'machine' }) : acc.girl
    if (acc.awakenedNow && after.memory) after = addEvent(after, { day: save.currentDay, kind: 'awaken', text: `第${save.currentDay}天夜里在机械调教室觉醒了器具癖`, w: 3, scene: 'machine' })
    return after
  })
  // 事件：过夜未处理扣服从；再按概率随机一人闯祸（记在新的一天）。阴影不产生夜间事件（只在调教里起作用）
  const girls = nightlyIncidents(rested.map((g) => compactMemory(g, save.currentDay)), save.currentDay + 1, rng)
  // 调教场景维护费（扣到 0 为止）
  const upkeep = sceneUpkeep(save.player)
  const paid = Math.min(upkeep, Math.max(0, save.player.gold))
  const charged: GameSave = paid ? { ...save, player: { ...save.player, gold: save.player.gold - paid } } : save
  const restNote = restSummary(save, plan)
  const lastDaySummary = { ...buildDaySummary(charged, girls), ...(upkeep ? { upkeep: paid } : {}), ...(nightNote ? { night: nightNote } : {}), ...(restNote ? { rest: restNote } : {}) }
  const next = { ...charged, currentDay: save.currentDay + 1, girls }
  return {
    ...charged,
    lastDaySummary,
    dayLog: freshDayLog(next),
    currentDay: save.currentDay + 1,
    actionsUsedToday: 0,
    appearedToday: [],
    machineNightGirlId: undefined,
    girls,
    dailyGuests: nextDayGuests(save, save.currentDay + 1, girls),
  }
}

/** 昨日小结的「休养」一行（没有休养加成时为空） */
export function restSummary(save: GameSave, plan: NightRest[] = nightPlan(save)): string {
  const n = unusedActions(save)
  const idle = plan.filter((p) => p.idle > 0).map((p) => p.name)
  const parts = [n ? `剩 ${n} 次行动，全员 +${n * UNUSED_ACTION_REST_BONUS}` : '', idle.length ? `没出场的${idle.join('、')}再 +${IDLE_REST_BONUS} 并解除疲惫` : '']
  return parts.filter(Boolean).join('；')
}

/** 今晚真正会挂机的人：已购机械调教室、人还在、今天没出场 */
export function machineNightTarget(save: GameSave): string | undefined {
  const id = save.machineNightGirlId
  if (!id || !ownsScene(save, 'machine')) return undefined
  if (!save.girls.some((g) => g.id === id) || (save.appearedToday ?? []).includes(id)) return undefined
  return id
}

/** 指定 / 取消今晚挂机的人（不占行动；今天已出场的不行） */
export function setMachineNight(save: GameSave, girlId: string | null): HubResult {
  if (!girlId) return { ok: true, message: '今晚不挂机', save: { ...save, machineNightGirlId: undefined } }
  if (!ownsScene(save, 'machine')) return { ok: false, error: '还没有机械调教室' }
  const girl = save.girls.find((g) => g.id === girlId)
  if (!girl) return { ok: false, error: '找不到这名魔物娘' }
  if ((save.appearedToday ?? []).includes(girlId)) return { ok: false, error: `${girl.name}今天已经出场过，不能再挂机` }
  return { ok: true, message: `今晚让${girl.name}在机械调教室过夜（服从 +${MACHINE_NIGHT_OBEDIENCE}，体力恢复减半）`, save: { ...save, machineNightGirlId: girlId } }
}

// ─── 新魔物娘入馆：领头人与本地模板 ───────────────────────────────────────────

/** 领头人好感门槛（待确认数值） */
export const ARRIVAL_LEADER_MIN_AFFECTION = 50

export type ArrivalLeader = { kind: 'girl'; girl: MonstGirl } | { kind: 'player' }

/** 馆内（不含新人）好感最高且 ≥50 的魔物娘领头；并列取先入馆者；都不到时由馆主出面 */
export function pickArrivalLeader(girls: MonstGirl[], newGirlId: string): ArrivalLeader {
  let best: MonstGirl | null = null
  for (const g of girls) {
    if (g.id === newGirlId || g.affection < ARRIVAL_LEADER_MIN_AFFECTION) continue
    if (!best || g.affection > best.affection) best = g
  }
  return best ? { kind: 'girl', girl: best } : { kind: 'player' }
}

export function arrivalFallbackText(leader: ArrivalLeader, playerName: string, newGirl: MonstGirl): string {
  return leader.kind === 'girl'
    ? `${leader.girl.name}领着${newGirl.name}在馆里转了一圈，把规矩一条条交代清楚，末了拍拍她的肩：「以后就是自己人了。」`
    : `${playerName}亲自把${newGirl.name}领进门，带她看过房间和大厅。${newGirl.name}四处打量着，神情还有些拘谨。`
}

export function arrivalPromptNote(leader: ArrivalLeader, playerName: string, newGirl: MonstGirl): string {
  return leader.kind === 'girl'
    ? `【入馆安排】由馆里好感最高的魔物娘${leader.girl.name}（${leader.girl.race}，性格：${leader.girl.personality}${speechLine(leader.girl, '；')}）出面迎接新人${newGirl.name}，带她熟悉娼馆、交代规矩。以${leader.girl.name}为主导写这段入馆对话。`
    : `【入馆安排】由馆主${playerName}亲自迎接新人${newGirl.name}，带她熟悉娼馆。以馆主为主导写这段入馆对话。`
}

// ─── 常客关系记忆：合并进回头客池 ─────────────────────────────────────────────


/** 回头客池里有这位客人时，用新记忆覆盖；没有时原样返回 */
export function mergeRegularMemories(regulars: Guest[], guestId: string, memories: NonNullable<Guest['memories']>): Guest[] {
  return regulars.map((r) => (r.id === guestId ? { ...r, memories } : r))
}

/** 把一位魔物娘的新印象并入已有记忆，visitCount 递增 */
export function mergeGirlMemory(
  existing: Guest['memories'], girlName: string, parsed: { guestAboutGirl?: string; girlAboutGuest?: string },
): NonNullable<Guest['memories']> {
  const prev = existing?.[girlName]
  return {
    ...(existing ?? {}),
    [girlName]: {
      guestAboutGirl: parsed.guestAboutGirl ?? '',
      girlAboutGuest: parsed.girlAboutGuest ?? '',
      visitCount: (prev?.visitCount ?? 0) + 1,
    },
  }
}

// ─── 阶段 7：设施横幅、升级反馈、指定床位 ─────────────────────────────────────

export type FacilityKey = 'brothel' | 'dorm' | 'service' | 'training'

/** 横幅路径：public/banners/<设施>-<等级>.webp，等级夹在 1–4 */
export function bannerPath(facility: FacilityKey, level?: number): string {
  return `/banners/${facility}-${Math.max(1, Math.min(4, level ?? 1))}.webp`
}

/** 金币不足时的差额文字；够钱或满级返回空串 */
export function shortfallText(cost: number | null, gold: number): string {
  return cost !== null && gold < cost ? `还差 ${cost - gold}G` : ''
}

/** 升级后的变化说明，如「服务房间 Lv.2：额外 play 槽 0 → 1」 */
export function upgradeChangeText(facility: FacilityKey, from: number, to: number): string {
  switch (facility) {
    case 'brothel': return `娼馆 Lv.${to}：魔物娘上限 ${getGirlCapacity(from)} → ${getGirlCapacity(to)}，每日客人 ${getGuestCapacity(from)} → ${getGuestCapacity(to)}`
    case 'dorm': {
      const a = getDormInfo(from), b = getDormInfo(to)
      return `宿舍 Lv.${to}（${b.name}）：每晚体力 +${a.nightly} → +${b.nightly}${b.bestBedBonus && !a.bestBedBonus ? '，可指定床位' : ''}`
    }
    case 'service': return `服务房间 Lv.${to}：额外 play 槽 ${getPlaySlots(from)} → ${getPlaySlots(to)}`
    case 'training': return `调教室 Lv.${to}：收益倍率 ×${TRAINING_ROOM_MULT[from - 1]} → ×${TRAINING_ROOM_MULT[to - 1]}，道具槽 ${TRAINING_ROOM_PROP_SLOTS[from - 1]} → ${TRAINING_ROOM_PROP_SLOTS[to - 1]}`
  }
}

/** 宿舍单间：指定一人睡最好的床；传 null 取消。只在有单间加成时可用 */
export function setBestBed(save: GameSave, girlId: string | null): HubResult {
  if (!getDormInfo(save.player.dormLevel).bestBedBonus) return { ok: false, error: '宿舍升到单间后才能指定床位' }
  if (girlId && !save.girls.some((g) => g.id === girlId)) return { ok: false, error: '找不到这名魔物娘' }
  const g = save.girls.find((x) => x.id === girlId)
  return { ok: true, save: { ...save, bestBedGirlId: girlId ?? undefined }, message: g ? `今晚起${g.name}睡最好的床` : '已取消指定床位' }
}
