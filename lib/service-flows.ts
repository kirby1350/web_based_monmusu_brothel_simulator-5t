// 服务流程模板（第 5 点）：全馆最多 5 个，带名字、五步做法、可选的偏好 play。
// 只影响亲自上场的推荐和提示词里的叙述，不进计分；偏好 play 只是准备页的预选。
import type { GameSave, MonstGirl, Player, ServiceFlow } from './types'
import { STEP_STANDARD_ACTION } from './live-steps'
import { STEP_ACTION_MAX } from './catalog'

export const MAX_FLOWS = 5
export const FLOW_NAME_MAX = 10
export const STD_FLOW_ID = 'std'
/** 准备页的选择：她的专属做法 */
export const FLOW_GIRL = 'girl'

export type FlowResult = { ok: true; save: GameSave; message: string } | { ok: false; error: string }

const blank = () => STEP_STANDARD_ACTION.map(() => '')
const cleanActions = (a: string[] | undefined) => STEP_STANDARD_ACTION.map((_, i) => (a?.[i] ?? '').trim().slice(0, STEP_ACTION_MAX))

/** 迁移：没有模板时把旧的 player.stepActions 变成「标准」模板并设为默认（幂等） */
export function migrateFlows(p: Player): Player {
  if (p.serviceFlows) {
    const ok = p.serviceFlows.some((f) => f.id === p.defaultFlowId)
    return ok || !p.serviceFlows.length ? p : { ...p, defaultFlowId: p.serviceFlows[0].id }
  }
  const std: ServiceFlow = { id: STD_FLOW_ID, name: '标准', actions: cleanActions(p.stepActions) }
  const { stepActions: _legacy, ...rest } = p
  void _legacy
  return { ...rest, serviceFlows: [std], defaultFlowId: STD_FLOW_ID }
}

export function getFlows(p: Player): ServiceFlow[] { return migrateFlows(p).serviceFlows ?? [] }
export function getDefaultFlow(p: Player): ServiceFlow | undefined {
  const m = migrateFlows(p)
  return m.serviceFlows?.find((f) => f.id === m.defaultFlowId)
}

export function hasGirlFlow(g?: Pick<MonstGirl, 'stepActions'>): boolean { return !!g?.stepActions?.some((x) => x?.trim()) }

/** 这一场用哪套：未选 → 她的专属，否则全馆默认；FLOW_GIRL → 她的专属；其他 → 指定模板 */
export function defaultFlowChoice(p: Player, g?: Pick<MonstGirl, 'stepActions'>): string {
  return hasGirlFlow(g) ? FLOW_GIRL : (getDefaultFlow(p)?.id ?? STD_FLOW_ID)
}

export interface ResolvedFlow { choice: string; name: string; actions: string[]; plays: { step: number; playId: string }[] }

export function resolveFlow(p: Player, g: Pick<MonstGirl, 'stepActions' | 'name'> | undefined, choice?: string): ResolvedFlow {
  const c = choice ?? defaultFlowChoice(p, g)
  const def = getDefaultFlow(p)
  const flow = c === FLOW_GIRL ? undefined : (getFlows(p).find((f) => f.id === c) ?? def)
  const girlActs = c === FLOW_GIRL ? g?.stepActions : undefined
  const actions = STEP_STANDARD_ACTION.map((d, i) => girlActs?.[i]?.trim() || flow?.actions[i]?.trim() || (c === FLOW_GIRL ? def?.actions[i]?.trim() : '') || d)
  return { choice: flow ? flow.id : FLOW_GIRL, name: flow ? flow.name : `${g?.name ?? '她'}的专属做法`, actions, plays: flow?.plays ?? [] }
}

const withFlows = (save: GameSave, flows: ServiceFlow[], defaultFlowId?: string): GameSave => {
  const p = migrateFlows(save.player)
  return { ...save, player: { ...p, serviceFlows: flows, defaultFlowId: defaultFlowId ?? p.defaultFlowId } }
}

export function saveFlow(save: GameSave, flow: { id?: string; name: string; actions: string[]; plays?: { step: number; playId: string }[] }, newId: () => string): FlowResult {
  const name = flow.name.trim().slice(0, FLOW_NAME_MAX)
  if (!name) return { ok: false, error: '给流程起个名字' }
  const flows = getFlows(save.player)
  const clean: ServiceFlow = { id: flow.id ?? newId(), name, actions: cleanActions(flow.actions), ...(flow.plays?.length ? { plays: flow.plays.slice(0, 3) } : {}) }
  const i = flows.findIndex((f) => f.id === clean.id)
  if (i < 0 && flows.length >= MAX_FLOWS) return { ok: false, error: `最多 ${MAX_FLOWS} 个流程模板` }
  const next = i < 0 ? [...flows, clean] : flows.map((f, j) => (j === i ? clean : f))
  return { ok: true, save: withFlows(save, next), message: i < 0 ? `新建了流程「${name}」` : `已保存「${name}」` }
}

export function duplicateFlow(save: GameSave, id: string, newId: () => string): FlowResult {
  const src = getFlows(save.player).find((f) => f.id === id)
  if (!src) return { ok: false, error: '找不到这个流程' }
  return saveFlow(save, { name: `${src.name}副本`.slice(0, FLOW_NAME_MAX), actions: src.actions, plays: src.plays }, newId)
}

export function deleteFlow(save: GameSave, id: string): FlowResult {
  const flows = getFlows(save.player)
  const f = flows.find((x) => x.id === id)
  if (!f) return { ok: false, error: '找不到这个流程' }
  if (flows.length <= 1) return { ok: false, error: '至少保留一个流程' }
  const next = flows.filter((x) => x.id !== id)
  const p = migrateFlows(save.player)
  const def = p.defaultFlowId === id ? next[0].id : p.defaultFlowId
  return { ok: true, save: withFlows(save, next, def), message: `删除了「${f.name}」${p.defaultFlowId === id ? `，默认改为「${next[0].name}」` : ''}` }
}

export function setDefaultFlow(save: GameSave, id: string): FlowResult {
  const f = getFlows(save.player).find((x) => x.id === id)
  if (!f) return { ok: false, error: '找不到这个流程' }
  return { ok: true, save: withFlows(save, getFlows(save.player), id), message: `「${f.name}」设为全馆默认` }
}

export const blankActions = blank

/** 这一场实际用的流程（准备页定下，交给亲自上场与结果页的叙述） */
export interface SessionFlow { choice: string; name: string; actions: string[]; playSteps?: Record<string, number> }

/** 把挂到某一步的 play 写进那一步的做法文字（只进提示词）：「上前迎接（穿插：深喉）」 */
export function stepActionsWithPlays(actions: string[], playSteps: Record<string, number> | undefined, playName: (id: string) => string | undefined): string[] {
  return actions.map((a, i) => {
    const names = Object.entries(playSteps ?? {}).filter(([, s]) => s === i).map(([id]) => playName(id)).filter(Boolean)
    return names.length ? `${a}（穿插：${names.join('、')}）` : a
  })
}

/** 选模板时预选它的偏好 play：只取这一场可选的，最多 slots 个 */
export function preferredPlays(flowPlays: { step: number; playId: string }[], available: string[], slots: number): { plays: string[]; playSteps: Record<string, number> } {
  const avail = new Set(available)
  const picked = flowPlays.filter((p) => avail.has(p.playId)).filter((p, i, a) => a.findIndex((x) => x.playId === p.playId) === i).slice(0, Math.max(0, slots))
  return { plays: picked.map((p) => p.playId), playSteps: Object.fromEntries(picked.map((p) => [p.playId, p.step])) }
}
