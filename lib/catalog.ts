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
/** 服装或丝袜对上客人喜好：迎客 +6（v3 平衡：+4 → +6，让衣橱 30 天内大致回本）；穿错 −2 */
export const OUTFIT_GREET_BONUS = 6
export const OUTFIT_GREET_MISMATCH = -2
/** 技能档对口加成（满意度，直接加，不受单步 14 上限）：迎客看待客、前戏看手技、正戏看主类型 */
export const SKILL_RANK_BONUS: Record<SkillRank, number> = { 初学: 0, 熟练: 5, 精通: 9 }

export const STANDARD_MAX = 70
export const WRONG_SIDE_PLAY_PENALTY = -12
/** 特训：每 2 点进度升一档 */
export const SKILL_PROGRESS_PER_RANK = 2

// ─── 额外 play ────────────────────────────────────────────────────────────────

export interface PlayMatch { services?: DesireService[]; kinds?: DesireKind[]; keywords?: string[] }
export interface PlayDef {
  id: string
  name: string
  source: SkillKey | 'race'
  zone?: SensitivityZone
  /** 种族专属 play：所属种族、固定计分档、对口条件（任一命中即对口） */
  race?: string
  rank?: SkillRank
  match?: PlayMatch
}

export const PLAYS: PlayDef[] = [
  { id: 'deepthroat', name: '深喉', source: '口侍', zone: '唇舌' },
  { id: 'paizuri', name: '乳交', source: '胸侍', zone: '乳房' },
  { id: 'positions', name: '体位变换', source: '身侍', zone: '小穴' },
  { id: 'long_massage', name: '按摩加长', source: '手技' },
  { id: 'lewd_dance', name: '色气舞蹈', source: '待客' },
  { id: 'endure', name: '承受调教', source: 'M性' },
  { id: 'drain', name: '主导榨取', source: 'S性' },
]

// 种族专属 play（阶段 9 确认表）：只要是她的种族就能选，不用先学
const rp = (race: string, id: string, name: string, rank: SkillRank, zone: SensitivityZone | undefined, match: PlayMatch): PlayDef =>
  ({ id: `race_${id}`, name, source: 'race', race, rank, zone, match })
export const RACE_PLAYS: Record<string, PlayDef[]> = {
  猫娘: [rp('猫娘', 'cat_lick', '猫舌舔舐', '熟练', '唇舌', { services: ['口侍'], keywords: ['尾巴', '兽耳'] }),
    rp('猫娘', 'cat_tail', '尾巴缠弄', '熟练', '种族', { services: ['种族'] })],
  犬娘: [rp('犬娘', 'dog_beg', '撒娇讨好', '初学', '种族', { kinds: ['中性'], services: ['待客'] }),
    rp('犬娘', 'dog_obey', '忠犬服从', '熟练', '种族', { kinds: ['M'] })],
  狐娘: [rp('狐娘', 'fox_tails', '九尾抚弄', '熟练', '种族', { services: ['种族'] }),
    rp('狐娘', 'fox_illusion', '魅惑幻术', '熟练', '耳朵', { kinds: ['S'] })],
  兔娘: [rp('兔娘', 'bunny_ride', '持久骑乘', '熟练', '小穴', { services: ['身侍'], keywords: ['长时间'] })],
  史莱姆: [rp('史莱姆', 'slime_wrap', '包覆', '熟练', '种族', { kinds: ['中性'], services: ['身侍'] }),
    rp('史莱姆', 'slime_inner', '体内按摩', '初学', '种族', { services: ['手技'], keywords: ['灌满'] })],
  拉米亚: [rp('拉米亚', 'lamia_coil', '缠绕', '熟练', '种族', { kinds: ['M'] }),
    rp('拉米亚', 'lamia_gaze', '蛇瞳魅惑', '熟练', '种族', { kinds: ['M'] }),
    rp('拉米亚', 'lamia_hair', '尾尖撩拨', '初学', '种族', { kinds: ['中性'], keywords: ['尾巴'] })],
  哈比: [rp('哈比', 'harpy_wing', '羽翼抚触', '熟练', '种族', { kinds: ['中性'], services: ['待客'] }),
    rp('哈比', 'harpy_air', '空中体位', '熟练', '小穴', { services: ['身侍'] })],
  蜘蛛娘: [rp('蜘蛛娘', 'spider_bind', '丝线束缚', '熟练', '种族', { kinds: ['M'] })],
  龙娘: [rp('龙娘', 'dragon_press', '龙威压制', '精通', '种族', { kinds: ['S'] })],
  精灵: [rp('精灵', 'elf_whisper', '精灵低语', '熟练', '耳朵', { kinds: ['中性'], services: ['待客'] })],
  黑暗精灵: [rp('黑暗精灵', 'drow_night', '暗夜侍奉', '熟练', '耳朵', { kinds: ['S'], keywords: ['痴女'] })],
  吸血鬼: [rp('吸血鬼', 'vamp_kiss', '吸血之吻', '熟练', '唇舌', { kinds: ['S'] })],
  魔女: [rp('魔女', 'witch_crest', '淫纹魔法', '熟练', undefined, { kinds: ['中性', 'S'] })],
  鬼娘: [rp('鬼娘', 'oni_press', '怪力压制', '熟练', '种族', { kinds: ['S'], keywords: ['粗暴'] })],
  牛娘: [rp('牛娘', 'cow_milk', '乳汁侍奉', '熟练', '种族', { services: ['胸侍'], keywords: ['乳交'] })],
  狼娘: [rp('狼娘', 'wolf_wild', '野性交合', '熟练', '种族', { kinds: ['M'], keywords: ['操服'] })],
}
export const ALL_PLAYS: PlayDef[] = [...PLAYS, ...Object.values(RACE_PLAYS).flat()]

/** 种族专属 play 对口：主需求、M/S 倾向、需求关键词任一命中 */
export function racePlayMatched(play: PlayDef, guest: Guest): boolean {
  const m = play.match
  if (!m) return false
  const p = getGuestProfile(guest)
  return !!(m.services?.includes(p.service) || m.kinds?.includes(p.kind) || m.keywords?.some((k) => (guest.desires ?? '').includes(k)))
}

/** 服务房间等级 → 额外 play 槽 */
export const SERVICE_ROOM_PLAY_SLOTS = [0, 1, 2, 3]
export function getPlaySlots(roomLevel?: number): number {
  const lv = Math.max(1, Math.min(4, roomLevel ?? 1))
  return SERVICE_ROOM_PLAY_SLOTS[lv - 1]
}

// ─── 衣橱 ─────────────────────────────────────────────────────────────────────

/** effect：调教里的小加成说明（只用于展示；结算在 resolve-training.ts） */
export interface OutfitDef { id: OutfitId; name: string; price: number; pref: OutfitPref | null; tags?: string; desc?: string; effect?: string }
export const OUTFITS: OutfitDef[] = [
  { id: 'regular', name: '她的常服', price: 0, pref: null, desc: '她平时就这么穿——你最熟悉、也最容易让她放松的样子。' },
  { id: 'maid', name: '露肩迷你女仆装', price: 200, pref: '制服', tags: 'maid outfit, maid headdress, apron, frills, off-shoulder, miniskirt, garter straps',
    desc: '荷叶边短裙堪堪盖住臀线，弯腰收拾时围裙下的风景一览无余：「主人，请慢用。」' },
  { id: 'kimono', name: '松襟振袖', price: 200, pref: '和服', tags: 'kimono, obi, japanese clothes, loose kimono, off shoulder, untied obi',
    desc: '衣襟松松地滑到肩头，腰带一扯就散，花纹艳得像要把人吸进去。' },
  { id: 'crotchless', name: '开裆蕾丝情趣内衣', price: 180, pref: '暴露', tags: 'crotchless, revealing clothes, lingerie, black lace, crotchless panties, garter belt',
    desc: '黑蕾丝勾勒出每一寸曲线，唯独最要紧的地方什么也没有。', effect: '敏感开发阴蒂/小穴/后庭 +2' },
  { id: 'restraint', name: '皮带拘束衣', price: 240, pref: '想施虐的客人', tags: 'straitjacket, bondage outfit, leather straps',
    desc: '双臂被交叉锁在身前，只剩眼神和喘息还能求饶。', effect: '驯服/惩罚 服从 +1' },
  { id: 'queen', name: '漆皮女王装', price: 240, pref: '想被榨的客人', tags: 'dominatrix, latex, thigh boots, corset, shiny leather, riding crop',
    desc: '漆皮束腰、过膝长靴与一根细鞭，她低头看你时，你就已经跪下了。', effect: '放权 淫乱 +1' },
  { id: 'bunny', name: '兔女郎装', price: 220, pref: '兔女郎', tags: 'playboy bunny, black leotard, rabbit ears headband, bowtie, wrist cuffs, fishnet pantyhose, highleg',
    desc: '高衩亮面连体衣勒出腰臀，领结、袖口与兔耳发箍一样不少，只有臀后那团绒尾在随步子轻颤。', effect: '敏感开发耳朵 +2（有耳羽时不叠加）' },
  { id: 'qipao', name: '高开衩旗袍', price: 220, pref: '异域', tags: 'china dress, red qipao, high side slit, thighs, gold embroidery',
    desc: '绛红缎面贴身到不留一丝余地，开衩一路开到腰骨，走一步就露出整截雪白的大腿根。' },
  { id: 'dancer', name: '舞娘纱衣', price: 220, pref: '异域', tags: 'harem outfit, dancer, see-through veil, belly chain, gold jewelry, midriff',
    desc: '薄纱只遮住该遮的那一点，腰链与金铃随扭胯叮当作响，一曲跳完，纱已贴在汗湿的肌肤上。', effect: '特训「待客」进度 +1（有练习镜时不叠加）' },
  { id: 'babydoll', name: '透纱睡裙', price: 180, pref: '暴露', tags: 'babydoll, see-through nightgown, black lingerie, sheer fabric',
    desc: '一层薄得像呼吸的黑纱，从胸口松松垂到大腿，灯一照，底下什么都没穿。', effect: '放权 淫乱 +1' },
  { id: 'sling', name: '吊带泳衣', price: 180, pref: '暴露', tags: 'sling bikini, slingshot swimsuit, revealing swimsuit',
    desc: '两根细带从肩头勒过乳尖再汇进腿间，与其说是泳衣，不如说是一道邀请。', effect: '敏感开发乳房 +2（有乳夹时不叠加）' },
  { id: 'nurse', name: '护士装', price: 200, pref: '制服', tags: 'nurse, nurse cap, white nurse uniform, short dress, garter straps',
    desc: '短到遮不住吊带的白色护士裙，胸前别着体温计，「请躺好，接下来要检查全身哦」。' },
  { id: 'school', name: '学生制服', price: 200, pref: '制服', tags: 'school uniform, serafuku, pleated miniskirt, loose neckerchief',
    desc: '水手领下松开的领结、短到大腿的百褶裙，一身规矩制服被她穿出了放学后的味道。' },
  { id: 'miko', name: '巫女服', price: 200, pref: '和服', tags: 'miko, white kimono, red hakama, wide sleeves, sideboob',
    desc: '白衣绯袴本是神前的装束，袖口与侧缝却开得太大，参拜时稍一弯腰便春光乍泄。' },
  { id: 'nun', name: '修女服', price: 220, pref: '圣洁', tags: 'nun, black habit, veil, side slit, cross necklace',
    desc: '漆黑修女袍一丝不苟地扣到喉咙，裙摆却开衩到大腿，十字架就悬在两团丰盈之间。', effect: '驯服 服从 +1' },
  { id: 'bridal', name: '纯白婚纱内衣', price: 260, pref: '圣洁', tags: 'bridal lingerie, white lace, bridal veil, white corset, garter belt',
    desc: '蕾丝头纱、白色束腰与吊带袜，像只为一个人准备的新婚夜，纯白得叫人想亲手弄脏。', effect: '任意调教 好感 +1' },
  { id: 'latex', name: '乳胶紧身衣', price: 260, pref: '想被榨的客人', tags: 'latex bodysuit, black latex, shiny clothes, zipper, skin tight',
    desc: '漆黑乳胶从脖颈一路包到脚尖，紧得能看清每一道曲线，拉链只要往下拉一寸就再也停不住。', effect: '放权 淫乱 +1' },
  { id: 'harness', name: '皮革束带装', price: 240, pref: '想施虐的客人', tags: 'leather harness, body harness, o-ring, black straps, choker',
    desc: '几道黑皮带交错勒过胸口、腰身与大腿，金属环正好留给牵绳，几乎什么也没遮。', effect: '惩罚 M 进度 +1' },
]
export interface StockingDef { id: StockingId; name: string; price: number; pref: OutfitPref | null; tags?: string; desc?: string }
export const STOCKINGS: StockingDef[] = [
  { id: 'none', name: '不加', price: 0, pref: null },
  { id: 'black', name: '黑色薄丝裤袜', price: 120, pref: '黑丝', tags: 'black pantyhose, shiny pantyhose',
    desc: '薄得透出肤色的黑丝，从脚尖一路裹到腰，指尖划过会沙沙作响。' },
  { id: 'white', name: '白色薄丝裤袜', price: 120, pref: '白丝', tags: 'white pantyhose',
    desc: '白得近乎透明，贴着腿弯泛着柔光，纯洁得让人想弄脏。' },
  { id: 'garter', name: '黑色吊带丝袜', price: 140, pref: '黑丝', tags: 'black thighhighs, garter belt, lace trim',
    desc: '蕾丝袜口被吊带紧紧咬住，在大腿上勒出一圈软肉。' },
  { id: 'fishnet', name: '渔网袜', price: 140, pref: '暴露', tags: 'fishnet pantyhose',
    desc: '粗网格把雪白的腿切成一格一格，越往上网眼越疏。' },
  { id: 'lace_white', name: '白蕾丝过膝袜', price: 140, pref: '圣洁', tags: 'white thighhighs, lace-trimmed legwear',
    desc: '纯白蕾丝停在膝上一掌，留出那一截最干净也最惹人的绝对领域。' },
]
export const OUTFIT_PREFS: OutfitPref[] = ['制服', '和服', '黑丝', '白丝', '暴露', '想施虐的客人', '想被榨的客人', '兔女郎', '异域', '圣洁']
/** 客人服装喜好的抽取权重：新喜好 0.7，最便宜的对口路线（黑丝/白丝/暴露）1.2，其余 1 */
export const OUTFIT_PREF_WEIGHTS: Record<OutfitPref, number> = {
  制服: 1, 和服: 1, 黑丝: 1.2, 白丝: 1.2, 暴露: 1.2, 想施虐的客人: 1, 想被榨的客人: 1, 兔女郎: 0.7, 异域: 0.7, 圣洁: 0.7,
}
/** 按权重抽一个服装喜好；rand 默认 Math.random（sim 会替换为带种子的随机） */
export function pickOutfitPref(rand: () => number = Math.random): OutfitPref {
  const total = OUTFIT_PREFS.reduce((a, p) => a + OUTFIT_PREF_WEIGHTS[p], 0)
  let r = rand() * total
  for (const p of OUTFIT_PREFS) { r -= OUTFIT_PREF_WEIGHTS[p]; if (r < 0) return p }
  return OUTFIT_PREFS[OUTFIT_PREFS.length - 1]
}
export const outfitName = (id: OutfitId | undefined): string => OUTFITS.find((o) => o.id === id)?.name ?? '常服'

// ─── 恢复药 / 塑形药 / 调教道具 ──────────────────────────────────────────────

export interface RecoveryItem { id: string; name: string; price: number; stamina: number | 'full'; clearsExhaustion?: boolean }
export const RECOVERY_ITEMS: RecoveryItem[] = [
  { id: 'hot_meal', name: '热餐', price: 40, stamina: 30 },
  { id: 'tonic_soup', name: '滋补汤', price: 100, stamina: 60 },
  { id: 'vigor_potion', name: '精力药', price: 220, stamina: 'full', clearsExhaustion: true },
]

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
  牛娘: '乳根', 龙娘: '角根', 蜘蛛娘: '丝腺', 拉米亚: '鳞交界',
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

/** 种族天赋（被动）。拉米亚「缠缚」、蜘蛛娘「丝线」、猫娘「猫舌与尾巴」已删除，由专属 play 取代 */
export const RACE_TRAITS: Record<string, string> = {
  犬娘: '忠犬', 狐娘: '魅惑', 兔娘: '持久', 史莱姆: '柔体',
  哈比: '轻身', 龙娘: '傲骨', 精灵: '敏感', 黑暗精灵: '夜习', 吸血鬼: '反哺',
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

// ─── 道具图标（静态文件 public/icons/<类别>/<id>.webp；缺图时组件退回文字徽章） ───

export type IconCategory = 'outfit' | 'stocking' | 'recovery' | 'sculpt' | 'prop' | 'scene'

export function itemIconPath(category: IconCategory, id: string): string | undefined {
  if (id === 'none') return undefined
  return `/icons/${category}/${id}.webp`
}

// ─── 定制调教道具：效果只从固定模板里选；每个模板等同一件现成道具（不改体力） ───

export interface CustomPropTemplate { id: string; label: string; baseProp: string; tier: 'tame' | 'release' | 'sculpt' | 'drill' | 'sensitize' }
export const CUSTOM_PROP_TEMPLATES: CustomPropTemplate[] = [
  { id: 'tpl_obedience', label: '驯服：服从 +3（同皮鞭）', baseProp: 'whip', tier: 'tame' },
  { id: 'tpl_m', label: '驯服：M 进度 +1（同拘束架）', baseProp: 'rack', tier: 'tame' },
  { id: 'tpl_lewd3', label: '放权：淫乱 +3（同按摩台）', baseProp: 'massage_table', tier: 'release' },
  { id: 'tpl_lewd2', label: '放权/塑形：淫乱 +2（同香炉）', baseProp: 'censer', tier: 'release' },
  { id: 'tpl_cm', label: '塑形：胸围或臀围多 1 厘米（同塑形架）', baseProp: 'sculpt_frame', tier: 'sculpt' },
  { id: 'tpl_progress', label: '特训：进度 +1（同练习镜）', baseProp: 'mirror', tier: 'drill' },
  ...TRAINING_PROPS.filter((p) => p.zone).map((p) => ({
    id: `tpl_zone_${p.zone}`, label: `敏感开发：${p.zone === '种族' ? '种族敏感带' : p.zone}对口 +4（同${p.name}）`, baseProp: p.id, tier: 'sensitize' as const,
  })),
]
export const MAX_CUSTOM_PROPS = 6
export const CUSTOM_PROP_NAME_MAX = 8
export const CUSTOM_PROP_DESC_MAX = 30
export const STEP_ACTION_MAX = 20

// ─── 阶段 10：事件与惩罚（数值待确认） ───────────────────────────────────────

export const INCIDENT_TEMPLATES: string[] = [
  '打碎了客人的酒杯', '偷懒被抓到', '和别的魔物娘吵架', '偷吃了厨房的点心', '把客人的外套弄脏了', '迟到了半个时辰',
]
/** 种族专属闯祸：只会落到对应种族身上 */
export const RACE_INCIDENT_TEMPLATES: Record<string, string[]> = {
  犬娘: ['把客人的鞋子叼去院子里埋了'],
  狐娘: ['用幻术捉弄客人，把对方吓得不轻'],
  史莱姆: ['渗进了地板缝，把账本泡烂了'],
  哈比: ['从窗口飞出去追蝴蝶，一下午没回来'],
  龙娘: ['偷偷把金币藏进了自己的窝里'],
  吸血鬼: ['大白天拉开窗帘晒伤，躺了半天不肯干活'],
  牛娘: ['奶水洒了一走廊，害客人滑了一跤'],
  魔女: ['熬药炸了锅，把厨房熏得一片漆黑'],
}
/** 按好感分档的闯祸：低好感（<30）是故意作对，高好感（≥70）是想引起你注意 */
export const INCIDENT_LOW_AFFECTION = 30
export const INCIDENT_HIGH_AFFECTION = 70
export const AFFECTION_INCIDENT_TEMPLATES: { low: string[]; high: string[] } = {
  low: ['当着客人的面顶撞了你', '趁夜想翻墙逃跑，被抓了回来'],
  high: ['为了吸引你的注意故意打翻茶水', '吃醋把别的魔物娘的衣服藏了起来'],
}
export const SERVICE_FAIL_INCIDENT_CHANCE = 0.5
export const DAILY_MISCHIEF_CHANCE = 0.15
export const PUNISH_EXTRA_OBEDIENCE = 3
export const PUNISH_EXTRA_M = 1
export const PUNISH_M_AFFECTION = 3
export const INCIDENT_OVERNIGHT_OBEDIENCE = 3

// ─── play 图标：美术到位后把 id 加进集合，文件放 public/icons/play/<id>.webp；没有时显示文字徽章 ───
export const PLAY_ICONS_READY = new Set<string>([
  'deepthroat', 'paizuri', 'positions', 'long_massage', 'lewd_dance', 'endure', 'drain',
  'race_cat_lick', 'race_cat_tail', 'race_dog_beg', 'race_dog_obey', 'race_fox_tails', 'race_fox_illusion', 'race_bunny_ride',
  'race_slime_wrap', 'race_slime_inner', 'race_lamia_coil', 'race_lamia_gaze', 'race_lamia_hair', 'race_harpy_wing', 'race_harpy_air',
  'race_spider_bind', 'race_dragon_press', 'race_elf_whisper', 'race_drow_night', 'race_vamp_kiss', 'race_witch_crest', 'race_oni_press',
  'race_cow_milk', 'race_wolf_wild',
])
export function playIconPath(id: string): string | undefined {
  return PLAY_ICONS_READY.has(id) ? `/icons/play/${id}.webp` : undefined
}

// ─── 跳过结算的匹配加成（只用于跳过，亲自上场不加） ───────────────────────────
/** 正戏主类型她会（已学）+6；每条对口且得分为正的 play +4（最多 2 条）；服装/丝袜对上喜好 +5 */
export const SKIP_MATCH_BONUS = { service: 6, play: 4, maxPlays: 2, outfit: 5 }
