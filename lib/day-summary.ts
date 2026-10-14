// 一天的经营小结：白天记账（dayLog），结束今天时生成 lastDaySummary 给大厅弹卡，关掉即清空
import type { GameSave, MonstGirl } from './types'

export interface DayServiceRecord { girl: string; guest: string; tier: string; sat: number; pay: number; regular: boolean; rep?: number }
export interface DayLog {
  day: number; startGold: number; startRep: number; start: Record<string, [number, number, number]>; services: DayServiceRecord[]
  /** 当天开始时已挂着的事件（girlId → 事件日 + 文本），用来区分新旧 */
  startIncidents?: Record<string, string>
}
export interface DaySummary {
  day: number; income: number; spent: number; repDelta: number
  tiers: Record<string, number>
  best?: { girl: string; sat: number; guest: string }
  regulars: { guest: string; sat: number; rolled: boolean }[]
  incidents: { girl: string; kind: string; text: string; status?: '新' | '已处理' }[]
  /** 之前就挂着、今天仍未处理的事件数（只出一行） */
  unresolved?: number
  stats: { girl: string; ob: number; lw: number; aff: number }[]
}

/** 「差一点」成为回头客的满意度线 */
export const NEAR_REGULAR_SAT = 62

const snap = (gs: MonstGirl[]) => Object.fromEntries(gs.map((g) => [g.id, [g.obedience, g.lewdness, g.affection] as [number, number, number]]))

const incKey = (g: MonstGirl) => (g.incident ? `${g.incident.day}|${g.incident.text}` : '')

export function freshDayLog(save: GameSave): DayLog {
  return {
    day: save.currentDay, startGold: save.player.gold, startRep: save.player.reputation ?? 0, start: snap(save.girls), services: [],
    startIncidents: Object.fromEntries(save.girls.filter((g) => g.incident).map((g) => [g.id, incKey(g)])),
  }
}

/** 取当天的账本；没有或是旧一天的就按当前状态新开 */
export function currentDayLog(save: GameSave): DayLog {
  return save.dayLog && save.dayLog.day === save.currentDay ? save.dayLog : freshDayLog(save)
}

export function logService(save: GameSave, rec: DayServiceRecord): GameSave {
  const log = currentDayLog(save)
  return { ...save, dayLog: { ...log, services: [...log.services, rec] } }
}

/** 用当天账本 + 结束时的状态（girls 已含夜间事件）生成小结 */
export function buildDaySummary(save: GameSave, girlsAfter: MonstGirl[] = save.girls): DaySummary {
  const log = currentDayLog(save)
  const income = log.services.reduce((a, s) => a + s.pay, 0)
  const tiers: Record<string, number> = {}
  for (const s of log.services) tiers[s.tier] = (tiers[s.tier] ?? 0) + 1
  const bestRec = log.services.reduce<DayServiceRecord | undefined>((a, s) => (!a || s.sat > a.sat ? s : a), undefined)
  const stats = girlsAfter.flatMap((g) => {
    const st = log.start[g.id]
    if (!st) return []
    const d = { girl: g.name, ob: g.obedience - st[0], lw: g.lewdness - st[1], aff: g.affection - st[2] }
    return d.ob || d.lw || d.aff ? [d] : []
  })
  return {
    day: log.day, income, spent: Math.max(0, log.startGold + income - save.player.gold),
    // 声望变化 = 当天各场实际变动之和（已含 0/100 截断）；导入/改档造成的跳变不算
    repDelta: log.services.reduce((a, x) => a + (x.rep ?? 0), 0), tiers,
    best: bestRec ? { girl: bestRec.girl, sat: bestRec.sat, guest: bestRec.guest } : undefined,
    regulars: log.services.filter((s) => s.regular || s.sat >= NEAR_REGULAR_SAT).map((s) => ({ guest: s.guest, sat: s.sat, rolled: s.regular })),
    ...incidentLines(log, save.girls, girlsAfter),
    stats,
  }
}

export function dismissDaySummary(save: GameSave): GameSave {
  return { ...save, lastDaySummary: null }
}

/** 只列当天新出的（含夜里的）和当天处理掉的；早就挂着、仍未处理的合成一个计数 */
function incidentLines(log: DayLog, girlsBefore: MonstGirl[], girlsAfter: MonstGirl[]): Pick<DaySummary, 'incidents' | 'unresolved'> {
  const startInc = log.startIncidents ?? {}
  const incidents: DaySummary['incidents'] = []
  let unresolved = 0
  for (const g of girlsAfter) {
    const was = startInc[g.id]
    if (g.incident) {
      if (was && was === incKey(g)) unresolved++
      else incidents.push({ girl: g.name, kind: g.incident.kind, text: g.incident.text, status: '新' })
    } else if (was) {
      const b = girlsBefore.find((x) => x.id === g.id)
      incidents.push({ girl: g.name, kind: b?.incident?.kind ?? '事件', text: was.split('|').slice(1).join('|'), status: '已处理' })
    }
  }
  return { incidents, unresolved }
}

/** 载入/导入时校验账本：不是今天的、或缺事件快照的，按当前状态重开（不会把整段声望当成变化） */
export function normalizeDayLog(save: GameSave): DayLog {
  const log = save.dayLog
  return log && log.day === save.currentDay && log.startIncidents ? log : freshDayLog(save)
}
