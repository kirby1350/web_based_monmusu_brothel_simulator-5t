// 预设魔物娘文案刷新（存档迁移的一部分，幂等）。
// 只动「文本字段」：年龄/外貌/性格/口癖/服装/背景/色色设定/生图 tag。好感、服从、淫乱、技能、敏感带、体力、立绘等一律不碰。
// 判定「玩家没改过」：存档里的值等于某一版旧预设文案（按指纹比对）。玩家手改过的字段原样保留。
import type { MonstGirl } from './types'
import { GIRL_TEMPLATES } from './game-data'
import { PRESET_TEXT_HISTORY } from './preset-history'
import { presetTextHash } from './preset-hash'

export const PRESET_TEXT_FIELDS = [
  'age', 'bodyDesc', 'bodyTags', 'personality', 'personalityTags', 'outfit', 'outfitTags',
  'otherDesc', 'otherTags', 'sexualDesc', 'imageTags', 'speechStyle',
] as const

/** 旧存档里可能整个缺失的字段：缺失即视为旧文案，直接补上 */
const FILL_IF_MISSING: readonly string[] = ['sexualDesc', 'speechStyle']

/** 预设三围改过的角色：旧值 → 新值。只在旧值原样且从未塑形时刷新（三围档位不变，见 character-diff） */
const PRESET_MEASUREMENT_UPDATES: Record<string, { from: [number, number, number]; to: [number, number, number] }> = {
  娜露梅亚: { from: [105, 60, 92], to: [108, 58, 90] },
}

export function refreshPresetText(girl: MonstGirl): MonstGirl {
  const tpl = GIRL_TEMPLATES.find((t) => t.name === girl.name && t.race === girl.race)
  const history = tpl && PRESET_TEXT_HISTORY[tpl.name]
  if (!tpl || !history) return girl
  let out: MonstGirl = girl
  for (const k of PRESET_TEXT_FIELDS) {
    const cur = girl[k]
    const next = tpl[k]
    if (typeof next !== 'string' || cur === next) continue
    const stale = cur === undefined ? FILL_IF_MISSING.includes(k) : typeof cur === 'string' && (history[k] ?? []).includes(presetTextHash(cur))
    if (stale) out = { ...out, [k]: next }
  }
  const mu = PRESET_MEASUREMENT_UPDATES[tpl.name]
  const sc = girl.sculptCounts
  const neverSculpted = !sc || (sc.bust === 0 && sc.waist === 0 && sc.hip === 0)
  if (mu && neverSculpted && girl.bust === mu.from[0] && girl.waist === mu.from[1] && girl.hip === mu.from[2]) {
    out = { ...out, bust: mu.to[0], waist: mu.to[1], hip: mu.to[2] }
  }
  return out
}
