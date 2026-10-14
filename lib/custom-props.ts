// 阶段 8：定制调教道具与「标准做法」自定义（纯函数）
import type { CustomProp, GameSave, MonstGirl, Player } from './types'
import {
  CUSTOM_PROP_TEMPLATES, CUSTOM_PROP_DESC_MAX, CUSTOM_PROP_NAME_MAX, MAX_CUSTOM_PROPS, STEP_ACTION_MAX, TRAINING_PROPS,
  type CustomPropTemplate,
} from './catalog'
import { STEP_STANDARD_ACTION } from './live-steps'

export type CustomResult = { ok: true; save: GameSave; message: string } | { ok: false; error: string }

/** 价格 = 同档现成道具最高价 × 1.2，向上取整到 10G */
export function customPropPrice(templateId: string): number | null {
  const t = CUSTOM_PROP_TEMPLATES.find((x) => x.id === templateId)
  if (!t) return null
  const peers = CUSTOM_PROP_TEMPLATES.filter((x) => x.tier === t.tier).map((x) => TRAINING_PROPS.find((p) => p.id === x.baseProp)!.price)
  return Math.ceil((Math.max(...peers) * 1.2) / 10) * 10
}

export function getTemplate(id: string): CustomPropTemplate | undefined {
  return CUSTOM_PROP_TEMPLATES.find((x) => x.id === id)
}

export function createCustomProp(save: GameSave, input: { name: string; desc: string; templateId: string }, id = `custom_${Date.now().toString(36)}`): CustomResult {
  const name = input.name.trim(), desc = input.desc.trim()
  const price = customPropPrice(input.templateId)
  const list = save.player.customProps ?? []
  if (price === null) return { ok: false, error: '请选择效果模板' }
  if (!name) return { ok: false, error: '请填写名字' }
  if (name.length > CUSTOM_PROP_NAME_MAX) return { ok: false, error: `名字最多 ${CUSTOM_PROP_NAME_MAX} 字` }
  if (desc.length > CUSTOM_PROP_DESC_MAX) return { ok: false, error: `描述最多 ${CUSTOM_PROP_DESC_MAX} 字` }
  if (list.length >= MAX_CUSTOM_PROPS) return { ok: false, error: `定制道具最多 ${MAX_CUSTOM_PROPS} 件` }
  if (save.player.gold < price) return { ok: false, error: `金币不足（还差 ${price - save.player.gold}G）` }
  const prop: CustomProp = { id, name, desc, templateId: input.templateId }
  return {
    ok: true, message: `定制了「${name}」（${price}G），调教时可选`,
    save: { ...save, player: { ...save.player, gold: save.player.gold - price, customProps: [...list, prop] } },
  }
}

/** 把勾选的道具（现成 id 或定制 id）展开成现成道具 id；同一效果只算一次 */
export function expandProps(selected: string[], customProps: CustomProp[] = []): string[] {
  const out = new Set<string>()
  for (const id of selected) {
    const c = customProps.find((x) => x.id === id)
    if (c) { const t = getTemplate(c.templateId); if (t) out.add(t.baseProp) }
    else out.add(id)
  }
  return [...out]
}

// ─── 标准做法：魔物娘 > 馆主 > 默认 ─────────────────────────────────────────

export function getStepActions(player?: Pick<Player, 'stepActions'>, girl?: Pick<MonstGirl, 'stepActions'>): string[] {
  return STEP_STANDARD_ACTION.map((d, i) => girl?.stepActions?.[i]?.trim() || player?.stepActions?.[i]?.trim() || d)
}

/** 规整输入：长度 5、每条截到 20 字；全空返回 undefined（即恢复默认） */
export function normalizeStepActions(raw: string[]): string[] | undefined {
  const a = STEP_STANDARD_ACTION.map((_, i) => (raw[i] ?? '').trim().slice(0, STEP_ACTION_MAX))
  return a.some(Boolean) ? a : undefined
}
