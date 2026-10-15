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

// ─── 内置种族模板：只读、可复制、不占 5 个名额；只改叙述，不计分 ─────────────────
export interface PresetFlow extends ServiceFlow { race: string; builtin: true }
const pf = (race: string, name: string, actions: string[], plays: [number, string][]): PresetFlow =>
  ({ id: `preset_${race}`, race, builtin: true, name, actions, plays: plays.map(([step, playId]) => ({ step, playId })) })
/** 顺序：店里初始就有的种族在前，其余（招募可能出现的）在后 */
export const PRESET_FLOWS: PresetFlow[] = [
  pf('牛娘', '牧场奶香', ['端上温热鲜奶迎客', '晃着颈铃贴身撒娇', '用丰满胸脯包裹爱抚', '以乳汁润滑温柔侍奉', '用温热奶巾为他擦身'], [[3, 'race_cow_milk'], [2, 'paizuri']]),
  pf('龙娘', '龙巢君临', ['端坐宝座俯视来客', '用尾尖挑起他的下巴', '龙爪尖沿肌肤轻划', '展翼压下主导全程', '卷进翼下赐予温存'], [[3, 'race_dragon_press'], [3, 'drain']]),
  pf('蜘蛛娘', '蛛网缠绵', ['自丝帘后款款现身', '吐丝轻缠他的手腕', '八足轻点细细抚弄', '悬于网中缠绵侍奉', '解开丝线拥他入眠'], [[1, 'race_spider_bind'], [2, 'long_massage']]),
  pf('拉米亚', '蛇缠之宴', ['摇曳蛇尾滑行迎客', '蛇瞳凝视低声蛊惑', '尾尖沿脊背撩拨', '层层盘绕紧拥侍奉', '盘成软榻让他休憩'], [[1, 'race_lamia_gaze'], [2, 'race_lamia_hair'], [3, 'race_lamia_coil']]),
  pf('猫娘', '猫咪撒娇', ['蹭着他的腿喵喵迎客', '竖起尾巴绕腰撒娇', '用小舌细细舔舐', '弓背翘尾热情侍奉', '蜷在怀里呼噜温存'], [[2, 'race_cat_lick'], [1, 'race_cat_tail']]),
  pf('犬娘', '忠犬侍奉', ['摇着尾巴扑上迎接', '叼来项圈撒娇讨好', '舔舔手心乖巧爱抚', '听令服从全力侍奉', '依偎脚边求摸摸头'], [[0, 'race_dog_beg'], [3, 'race_dog_obey']]),
  pf('狐娘', '九尾幻梦', ['点起狐火引客入梦', '九尾轻扫魅惑耳语', '以尾代手层层抚弄', '幻术迷离中侍奉', '用蓬松尾巴裹他入眠'], [[1, 'race_fox_illusion'], [2, 'race_fox_tails']]),
  pf('哈比', '云端羽舞', ['振翅落在他身旁', '用羽尖轻扫他颈侧', '展开羽翼包裹爱抚', '腾空交缠空中侍奉', '收翼将他护在怀中'], [[2, 'race_harpy_wing'], [3, 'race_harpy_air']]),
  pf('精灵', '森林低语', ['献上花冠优雅迎宾', '长耳轻颤低声吟唱', '以花精油细致按摩', '随林间韵律侍奉', '泉水净身轻吻额头'], [[1, 'race_elf_whisper'], [2, 'long_massage']]),
  pf('兔娘', '月兔长夜', ['蹦跳着拉他进房', '抖动长耳蹭蹭撒娇', '圆尾轻摇贴身爱抚', '不知疲倦持久骑乘', '抱着他数月亮温存'], [[1, 'lewd_dance'], [3, 'race_bunny_ride']]),
  pf('狼娘', '月夜狼嚎', ['嗅着气味绕他一圈', '轻咬耳垂低吼挑逗', '用爪背粗犷抚弄', '野性释放激烈交合', '舔舐咬痕依偎守护'], [[3, 'race_wolf_wild']]),
  pf('史莱姆', '凝胶包覆', ['化作人形软软迎客', '凉滑身体贴上撩拨', '凝胶流过全身按摩', '整个包覆温柔侍奉', '溶去汗水清洁全身'], [[2, 'race_slime_inner'], [3, 'race_slime_wrap']]),
  pf('吸血鬼', '夜宴血吻', ['烛光古堡优雅迎宾', '獠牙轻抵颈侧低语', '冰凉指尖缓缓游走', '俯身主导夜之侍奉', '一吻之后拥他休憩'], [[1, 'race_vamp_kiss'], [3, 'drain']]),
  pf('魔女', '魔药之夜', ['递上一杯微醺魔药', '指尖画符点亮淫纹', '咒语加持敏感爱抚', '魔法阵中缠绵侍奉', '净化咒语清洁温存'], [[1, 'race_witch_crest']]),
  pf('黑暗精灵', '暗夜宫廷', ['自暗影中现身迎客', '长耳贴近妖冶低语', '银饰冰凉轻触肌肤', '主导暗夜侍奉', '月光下慵懒相拥'], [[3, 'race_drow_night']]),
  pf('鬼娘', '鬼角豪宴', ['豪爽举杯大笑迎客', '一把将他揽进怀里', '怪力揉捏全身按摩', '压制在下尽兴侍奉', '酒后枕膝呼呼大睡'], [[2, 'long_massage'], [3, 'race_oni_press']]),
]
export const isPresetFlow = (id?: string) => !!id && PRESET_FLOWS.some((f) => f.id === id)
export const raceFlow = (race?: string) => PRESET_FLOWS.find((f) => f.race === race)
/** 用户模板 + 内置模板（查找用；名额只看 getFlows） */
const anyFlow = (p: Player, id: string): ServiceFlow | undefined => getFlows(p).find((f) => f.id === id) ?? PRESET_FLOWS.find((f) => f.id === id)
/** 全馆默认是不是玩家自己定的（非空白「标准」）：是 → 尊重默认；否 → 准备页先推荐她的种族模板 */
export function defaultIsCustomized(p: Player): boolean {
  const d = getDefaultFlow(p)
  return !!d && (d.id !== STD_FLOW_ID || d.actions.some((x) => x?.trim()) || !!d.plays?.length)
}
/** 准备页下拉的顺序：她的种族模板（推荐）在最前，然后用户模板，再其余内置 */
export function flowOptions(p: Player, g?: Pick<MonstGirl, 'race'>): { flow: ServiceFlow; builtin: boolean; suggested: boolean }[] {
  const mine = raceFlow(g?.race)
  return [
    ...(mine ? [{ flow: mine as ServiceFlow, builtin: true, suggested: true }] : []),
    ...getFlows(p).map((flow) => ({ flow, builtin: false, suggested: false })),
    ...PRESET_FLOWS.filter((f) => f !== mine).map((flow) => ({ flow: flow as ServiceFlow, builtin: true, suggested: false })),
  ]
}
export function getDefaultFlow(p: Player): ServiceFlow | undefined {
  const m = migrateFlows(p)
  return m.serviceFlows?.find((f) => f.id === m.defaultFlowId)
}

export function hasGirlFlow(g?: Pick<MonstGirl, 'stepActions'>): boolean { return !!g?.stepActions?.some((x) => x?.trim()) }

/** 这一场默认用哪套：她的专属 > 玩家自定的全馆默认 > 她的种族模板 > 「标准」 */
export function defaultFlowChoice(p: Player, g?: Pick<MonstGirl, 'stepActions'> & { race?: string }): string {
  if (hasGirlFlow(g)) return FLOW_GIRL
  const race = raceFlow(g?.race)
  if (race && !defaultIsCustomized(p)) return race.id
  return getDefaultFlow(p)?.id ?? STD_FLOW_ID
}

export interface ResolvedFlow { choice: string; name: string; actions: string[]; plays: { step: number; playId: string }[] }

export function resolveFlow(p: Player, g: (Pick<MonstGirl, 'stepActions' | 'name'> & { race?: string }) | undefined, choice?: string): ResolvedFlow {
  const c = choice ?? defaultFlowChoice(p, g)
  const def = getDefaultFlow(p)
  const flow = c === FLOW_GIRL ? undefined : (anyFlow(p, c) ?? def)
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
  if (isPresetFlow(flow.id)) return { ok: false, error: '内置模板只读，复制一份再改' }
  const flows = getFlows(save.player)
  const clean: ServiceFlow = { id: flow.id ?? newId(), name, actions: cleanActions(flow.actions), ...(flow.plays?.length ? { plays: flow.plays.slice(0, 3) } : {}) }
  const i = flows.findIndex((f) => f.id === clean.id)
  if (i < 0 && flows.length >= MAX_FLOWS) return { ok: false, error: `最多 ${MAX_FLOWS} 个流程模板` }
  const next = i < 0 ? [...flows, clean] : flows.map((f, j) => (j === i ? clean : f))
  return { ok: true, save: withFlows(save, next), message: i < 0 ? `新建了流程「${name}」` : `已保存「${name}」` }
}

export function duplicateFlow(save: GameSave, id: string, newId: () => string): FlowResult {
  const src = anyFlow(save.player, id)
  if (!src) return { ok: false, error: '找不到这个流程' }
  const name = isPresetFlow(id) ? src.name : `${src.name}副本`.slice(0, FLOW_NAME_MAX)
  return saveFlow(save, { name, actions: src.actions, plays: src.plays }, newId)
}

export function deleteFlow(save: GameSave, id: string): FlowResult {
  if (isPresetFlow(id)) return { ok: false, error: '内置模板不能删除' }
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
  if (isPresetFlow(id)) return { ok: false, error: '内置模板不能设为全馆默认，复制一份再设' }
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
