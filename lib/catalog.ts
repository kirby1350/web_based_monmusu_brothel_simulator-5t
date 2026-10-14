// 经营目录：技能、play、衣橱、道具、种族特技、敏感带、设施价格（TODO.md 已定数值）
import type {
  DesireKind, DesireService, Guest, Inclination, MonstGirl, OutfitId, OutfitPref,
  SensitivityLevel, SensitivityZone, ServingSkill, SkillKey, SkillRank, StockingId,
} from './types'

// ─── 服侍技能 / 档位 ────────────────────────────────────────────────────────────

export const SERVING_SKILL_LIST: ServingSkill[] = ['口侍', '胸侍', '身侍', '手技', '待客']
export const MAX_SERVING_SKILLS = 3
/** 服从 30、淫乱 40、好感 50 各弹出一次技能选择 */
export const SKILL_PICK_THRESHOLDS = [
  { stat: 'obedience', value: 30 },
  { stat: 'lewdness', value: 40 },
  { stat: 'affection', value: 50 },
] as const

/** 除迎客外的步骤分：无 4 / 初学 8 / 熟练 11 / 精通 14 */
export const STEP_SCORE: Record<SkillRank | '无', number> = { 无: 4, 初学: 8, 熟练: 11, 精通: 14 }
/** 迎客里的待客分：无 2 / 初学 4 / 熟练 6 / 精通 8 */
export const GREET_HOSTING_SCORE: Record<SkillRank | '无', number> = { 无: 2, 初学: 4, 熟练: 6, 精通: 8 }
/** 对口 play：初学 6 / 熟练 8 / 精通 10；不对口减半 */
export const PLAY_SCORE: Record<SkillRank, number> = { 初学: 6, 熟练: 8, 精通: 10 }
export const STEP_MAX = 14
export const STANDARD_MAX = 70
export const WRONG_SIDE_PLAY_PENALTY = -12
/** 特训：每 2 点进度升一档 */
export const SKILL_PROGRESS_PER_RANK = 2

// ─── 额外 play ────────────────────────────────────────────────────────────────

export interface PlayDef {
  id: string
  name: string
  source: SkillKey | 'race'
  zone?: SensitivityZone
}

export const PLAYS: PlayDef[] = [
  { id: 'deepthroat', name: '深喉', source: '口侍', zone: '唇舌' },
  { id: 'paizuri', name: '乳交', source: '胸侍', zone: '乳房' },
  { id: 'positions', name: '体位变换', source: '身侍', zone: '小穴' },
  { id: 'long_massage', name: '按摩加长', source: '手技' },
  { id: 'lewd_dance', name: '色气舞蹈', source: '待客' },
  { id: 'endure', name: '承受调教', source: 'M性' },
  { id: 'drain', name: '主导榨取', source: 'S性' },
  { id: 'race', name: '种族特技', source: 'race', zone: '种族' },
]

/** 服务房间等级 → 额外 play 槽 */
export const SERVICE_ROOM_PLAY_SLOTS = [0, 1, 2, 3]
export function getPlaySlots(roomLevel?: number): number {
  const lv = Math.max(1, Math.min(4, roomLevel ?? 1))
  return SERVICE_ROOM_PLAY_SLOTS[lv - 1]
}

// ─── 衣橱 ─────────────────────────────────────────────────────────────────────

export interface OutfitDef { id: OutfitId; name: string; price: number; pref: OutfitPref | null; tags?: string }
export const OUTFITS: OutfitDef[] = [
  { id: 'regular', name: '常服', price: 0, pref: null },
  { id: 'maid', name: '女仆装', price: 200, pref: '制服', tags: 'maid outfit, maid headdress, apron, frills' },
  { id: 'kimono', name: '和服', price: 200, pref: '和服', tags: 'kimono, obi, japanese clothes' },
  { id: 'crotchless', name: '开裆装', price: 180, pref: '暴露', tags: 'crotchless, revealing clothes, lingerie' },
  { id: 'restraint', name: '拘束衣', price: 240, pref: '想施虐的客人', tags: 'straitjacket, bondage outfit, leather straps' },
  { id: 'queen', name: '女王装', price: 240, pref: '想被榨的客人', tags: 'dominatrix, latex, thigh boots, corset' },
]
export interface StockingDef { id: StockingId; name: string; price: number; pref: OutfitPref | null; tags?: string }
export const STOCKINGS: StockingDef[] = [
  { id: 'none', name: '不加', price: 0, pref: null },
  { id: 'black', name: '黑丝', price: 120, pref: '黑丝', tags: 'black pantyhose' },
  { id: 'white', name: '白丝', price: 120, pref: '白丝', tags: 'white pantyhose' },
]
export const OUTFIT_PREFS: OutfitPref[] = ['制服', '和服', '黑丝', '白丝', '暴露', '想施虐的客人', '想被榨的客人']

// ─── 恢复药 / 塑形药 / 调教道具 ──────────────────────────────────────────────

export interface RecoveryItem { id: string; name: string; price: number; stamina: number | 'full'; clearsExhaustion?: boolean; rare?: boolean }
export const RECOVERY_ITEMS: RecoveryItem[] = [
  { id: 'hot_meal', name: '热餐', price: 40, stamina: 30 },
  { id: 'tonic_soup', name: '滋补汤', price: 100, stamina: 60 },
  { id: 'vigor_potion', name: '精力药', price: 220, stamina: 'full', clearsExhaustion: true, rare: true },
]
/** 精力药每天出现在货架的概率 */
export const VIGOR_POTION_CHANCE = 0.3

export type SculptStat = 'bust' | 'waist' | 'hip'
export interface SculptPotion { id: string; name: string; stat: SculptStat; delta: number }
export const SCULPT_POTIONS: SculptPotion[] = [
  { id: 'bust_up', name: '丰乳香膏', stat: 'bust', delta: 5 },
  { id: 'bust_down', name: '平胸药', stat: 'bust', delta: -5 },
  { id: 'hip_up', name: '丰臀药', stat: 'hip', delta: 4 },
  { id: 'hip_down', name: '收臀药', stat: 'hip', delta: -4 },
  { id: 'waist_down', name: '束腰药', stat: 'waist', delta: -2 },
  { id: 'waist_up', name: '放腰药', stat: 'waist', delta: 2 },
]
export const SCULPT_BOUNDS: Record<SculptStat, [number, number]> = { bust: [70, 120], waist: [50, 68], hip: [80, 120] }
export const SCULPT_BASE_PRICE = 180
export const SCULPT_PRICE_STEP = 80
/** 塑形药价格：起步 180G，该项每改过一次再贵 80G */
export function getSculptPrice(girl: Pick<MonstGirl, 'sculptCounts'>, stat: SculptStat): number {
  return SCULPT_BASE_PRICE + SCULPT_PRICE_STEP * (girl.sculptCounts?.[stat] ?? 0)
}

export interface TrainingProp { id: string; name: string; price: number; zone?: SensitivityZone }
export const TRAINING_PROPS: TrainingProp[] = [
  { id: 'whip', name: '皮鞭', price: 200 },
  { id: 'rack', name: '拘束架', price: 260 },
  { id: 'massage_table', name: '按摩台', price: 200 },
  { id: 'censer', name: '香炉', price: 180 },
  { id: 'sculpt_frame', name: '塑形架', price: 240 },
  { id: 'mirror', name: '练习镜', price: 220 },
  { id: 'feather', name: '耳羽', price: 160, zone: '耳朵' },
  { id: 'vibrator', name: '跳蛋', price: 200, zone: '阴蒂' },
  { id: 'nipple_clamps', name: '乳夹', price: 200, zone: '乳房' },
  { id: 'gag', name: '口衔', price: 160, zone: '唇舌' },
  { id: 'plug', name: '后庭塞', price: 220, zone: '后庭' },
  { id: 'horn_comb', name: '角梳', price: 180, zone: '种族' },
]

// ─── 设施 ─────────────────────────────────────────────────────────────────────

/** 升到第 2/3/4 级的花费（索引 = 当前等级 - 1） */
export const DORM_UPGRADE_COSTS = [400, 900, 1600]
export const SERVICE_ROOM_UPGRADE_COSTS = [500, 1000, 1800]
export const TRAINING_ROOM_UPGRADE_COSTS = [500, 1000, 1800]
export const DORM_LEVELS = [
  { name: '通铺', nightly: 25 },
  { name: '软床', nightly: 40 },
  { name: '浴场', nightly: 55, clearsExhaustion: true },
  { name: '单间', nightly: 70, bestBedBonus: 15 },
]
export const TRAINING_ROOM_MULT = [1, 1.25, 1.5, 2]
export const TRAINING_ROOM_PROP_SLOTS = [0, 1, 2, 3]
export const REST_STAMINA = 50
export const MAX_STAMINA = 100
export function getUpgradeCostFor(table: number[], level?: number): number | null {
  const lv = level ?? 1
  return lv >= 1 && lv <= table.length ? table[lv - 1] : null
}

// ─── 体力 ─────────────────────────────────────────────────────────────────────

export const SKIP_SERVICE_STAMINA = 40
export const LIVE_SERVICE_STAMINA_SHORT = 25
export const LIVE_SERVICE_STAMINA_LONG = 55
export const SKIP_OBEDIENCE_MIN = 25
export const DRAGON_SKIP_OBEDIENCE_MULT = 0.7

// ─── 敏感带 ───────────────────────────────────────────────────────────────────

export const COMMON_ZONES: SensitivityZone[] = ['耳朵', '阴蒂', '唇舌', '乳房', '小穴', '后庭']
export const RACE_ZONE_NAMES: Record<string, string> = {
  猫娘: '尾根', 犬娘: '尾根', 狐娘: '尾根', 狼娘: '尾根', 兔娘: '尾根',
  牛娘: '乳根', 龙娘: '角根', 蜘蛛娘: '丝腺', 拉米亚: '鳞交界', 美杜莎: '鳞交界',
  哈比: '翼膜', 史莱姆: '核', 鬼娘: '角',
}
export const SENSITIVITY_DEFAULT = 30
export const SENSITIVITY_SIGNATURE = 55
export const SENSITIVITY_ANAL_DEFAULT = 15
export const ANAL_UNLOCK = 51

export function getSensitivityLevel(value: number): SensitivityLevel {
  if (value >= 76) return '弱点'
  if (value >= 40) return '敏感'
  if (value <= 20) return '迟钝'
  return '普通'
}
export const SENSITIVITY_STEP_MOD: Record<SensitivityLevel, number> = { 迟钝: -2, 普通: 0, 敏感: 3, 弱点: 5 }
export const SENSITIVITY_STAMINA_MOD: Record<SensitivityLevel, number> = { 迟钝: -5, 普通: 0, 敏感: 8, 弱点: 15 }

/** 新人默认敏感带：共通 30，后庭 15；有种族带的种族签名带 55 */
export function defaultSensitivities(race: string): Partial<Record<SensitivityZone, number>> {
  const s: Partial<Record<SensitivityZone, number>> = {}
  for (const z of COMMON_ZONES) s[z] = z === '后庭' ? SENSITIVITY_ANAL_DEFAULT : SENSITIVITY_DEFAULT
  if (RACE_ZONE_NAMES[race]) s['种族'] = SENSITIVITY_SIGNATURE
  return s
}

// ─── 种族特技 ─────────────────────────────────────────────────────────────────

export const RACE_TRAITS: Record<string, string> = {
  猫娘: '猫舌与尾巴', 犬娘: '忠犬', 狐娘: '魅惑', 兔娘: '持久', 史莱姆: '柔体', 拉米亚: '缠缚',
  哈比: '轻身', 蜘蛛娘: '丝线', 龙娘: '傲骨', 精灵: '敏感', 黑暗精灵: '夜习', 吸血鬼: '反哺',
  魔女: '调剂', 鬼娘: '怪力', 牛娘: '乳侍', 狼娘: '野性',
}

// ─── 客人需求映射（现有八条需求 → 标签） ─────────────────────────────────────

export interface DesireProfile {
  kind: DesireKind
  service: DesireService
  /** 正戏之外也算对口的服侍类型（用于额外 play 对口判定） */
  secondary: ServingSkill[]
}

export const DESIRE_PROFILES: { keyword: RegExp; profile: DesireProfile }[] = [
  { keyword: /操服/, profile: { kind: 'M', service: '身侍', secondary: ['口侍'] } },
  { keyword: /粗暴支配|言语羞辱/, profile: { kind: 'M', service: '口侍', secondary: ['身侍'] } },
  { keyword: /嫌弃着榨干|榨干/, profile: { kind: 'S', service: '身侍', secondary: ['手技'] } },
  { keyword: /痴女|主动求欢/, profile: { kind: 'S', service: '口侍', secondary: ['待客'] } },
  { keyword: /乳交|深喉/, profile: { kind: '中性', service: '胸侍', secondary: ['口侍'] } },
  { keyword: /尾巴|兽耳/, profile: { kind: '中性', service: '种族', secondary: ['手技'] } },
  { keyword: /长时间|多次内射/, profile: { kind: '中性', service: '身侍', secondary: ['待客'] } },
  { keyword: /灌满|子宫|内射/, profile: { kind: '中性', service: '身侍', secondary: ['口侍'] } },
]

export function getDesireProfile(desires: string): DesireProfile {
  const hit = DESIRE_PROFILES.find((d) => d.keyword.test(desires))
  return hit ? hit.profile : { kind: '中性', service: '身侍', secondary: [] }
}

/** 客人画像：优先用已存的标签，缺省按 desires 原文映射 */
export function getGuestProfile(guest: Guest): DesireProfile {
  const base = getDesireProfile(guest.desires ?? '')
  return {
    kind: guest.desireKind ?? base.kind,
    service: guest.desireService ?? base.service,
    secondary: base.secondary,
  }
}

/** 档位工具 */
export function getSkillRank(girl: MonstGirl, skill: SkillKey): SkillRank | undefined {
  if (skill === '胸侍' && girl.race === '牛娘') return girl.skillRanks?.['胸侍'] ?? '初学'
  return girl.skillRanks?.[skill]
}

export function getInclination(girl: MonstGirl): Inclination {
  return girl.inclination ?? '无'
}
