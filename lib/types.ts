export type ImageStyle =
  | 'none'
  | 'dk.senie'
  | 'hakai_shin'
  | 'shiokonbu'
  | 'piromizu'
  | 'nohito'
  | 'masami_chie'

export type ImageModel = 'haruka_v2' | 'jankuv5' | 'wai_nsfw'

export type ImageProvider = 'pixai' | 'tensorart'

export type TensorArtModel = 'wai_nsfw_v16' | 'jankuv6'

// 叙事文风：standard 仅常驻去油约束；dense 在去油黑名单前提下把感官堆叠推到极致
export type ProseStyle = 'standard' | 'dense'

export const PROSE_STYLE_LABELS: Record<ProseStyle, { label: string; hint: string }> = {
  standard: { label: '标准', hint: '均衡叙事，仅常驻去油约束' },
  dense: { label: '重油堆叠', hint: '极致密集的感官堆叠流（仍遵守去油黑名单）' },
}

// DZMM v2 模型列表返回的单条模型
export interface DzmmModel {
  id: string
  name: string
  context_window: number
}

export interface AppSettings {
  chatModel: string
  imageModel: ImageModel
  imageStyle: ImageStyle
  imageStyleCustom: string
  imageProvider: ImageProvider
  tensorartModel: TensorArtModel
  proseStyle: ProseStyle
  chatApiKey: string
  grokApiKey: string
  pixaiApiKey: string
  tensorartApiKey: string
}

export const IMAGE_MODELS: Record<ImageModel, { label: string; modelId: string }> = {
  haruka_v2: {
    label: 'Haruka v2',
    modelId: '1861558740588989558',
  },
  jankuv5: {
    label: 'JANKUV5',
    modelId: '1935381284613355700',
  },
  wai_nsfw: {
    label: 'WAI-NSFW-illustrious-SDXL',
    modelId: '1799568502408553127',
  },
}

export const IMAGE_STYLES: Record<ImageStyle, { label: string; tags: string }> = {
  none: { label: '无', tags: '' },
  'dk.senie': {
    label: 'dk.senie',
    tags: 'dk.senie, watercolor, soft lineart, pastel colors, dreamy lighting',
  },
  hakai_shin: {
    label: 'Hakai Shin',
    tags: 'hakai_shin, detailed shading, dynamic pose, vibrant colors, anime illustration',
  },
  shiokonbu: {
    label: 'shiokonbu',
    tags: 'shiokonbu, detailed lineart, soft shading, moe style, clean illustration',
  },
  piromizu: {
    label: 'piromizu',
    tags: 'piromizu, glossy skin, detailed body, soft gradient, erotic illustration',
  },
  nohito: {
    label: 'nohito',
    tags: 'nohito, expressive face, fine details, dramatic lighting, anime art style',
  },
  masami_chie: {
    label: 'masami chie',
    tags: 'masami chie, soft lineart, delicate shading, warm palette, detailed illustration',
  },
}

export const TENSORART_MODELS: Record<TensorArtModel, { label: string; modelId: string }> = {
  wai_nsfw_v16: {
    label: 'WAI-NSFW-V16',
    modelId: '943946051788787917',
  },
  jankuv6: {
    label: 'JANKUV6',
    modelId: '934122074308367585',
  },
}

export const CHAT_MODELS: {
  value: string
  label: string
  group: string
  provider: 'default' | 'grok'
}[] = [
  // Max 系列 - 旗舰 ($0.0004/1K tokens)
  { value: 'nalang-max-0826-10k', label: 'Nalang Max 10K', group: 'Max 旗舰系列', provider: 'default' },
  { value: 'nalang-max-0826-16k', label: 'Nalang Max 16K（推荐）', group: 'Max 旗舰系列', provider: 'default' },
  { value: 'nalang-max-0826', label: 'Nalang Max 32K', group: 'Max 旗舰系列', provider: 'default' },
  // XL 系列 ($0.0003/1K tokens)
  { value: 'nalang-xl-0826-10k', label: 'Nalang XL 10K', group: 'XL 大模型系列', provider: 'default' },
  { value: 'nalang-xl-0826-16k', label: 'Nalang XL 16K（推荐）', group: 'XL 大模型系列', provider: 'default' },
  { value: 'nalang-xl-0826', label: 'Nalang XL 32K', group: 'XL 大模型系列', provider: 'default' },
  // Medium 系列 ($0.0002/1K tokens)
  { value: 'nalang-medium-0826', label: 'Nalang Medium 32K', group: 'Medium 性价比系列', provider: 'default' },
  // Turbo 系列 ($0.0001/1K tokens)
  { value: 'nalang-turbo-0826', label: 'Nalang Turbo 32K（推荐）', group: 'Turbo 快速系列', provider: 'default' },
  // 额外
  { value: 'x-apex-surge-0505-16k', label: 'Surge-0505 (16K)', group: 'Surge 系列', provider: 'default' },
  // Grok 系列
  { value: 'grok-4-latest', label: 'Grok 4 Latest', group: 'Grok (xAI)', provider: 'grok' },
  { value: 'grok-3', label: 'Grok 3', group: 'Grok (xAI)', provider: 'grok' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini', group: 'Grok (xAI)', provider: 'grok' },
]

export const DEFAULT_SETTINGS: AppSettings = {
  chatModel: 'nalang-max-0826-16k',
  imageModel: 'haruka_v2',
  imageStyle: 'none',
  imageStyleCustom: '',
  imageProvider: 'pixai',
  tensorartModel: 'wai_nsfw_v16',
  proseStyle: 'standard',
  chatApiKey: '',
  grokApiKey: '',
  pixaiApiKey: '',
  tensorartApiKey: '',
}

// ─── 经营规则类型（TODO.md） ──────────────────────────────────────────────────

export type SkillRank = '初学' | '熟练' | '精通'
export type ServingSkill = '口侍' | '胸侍' | '身侍' | '手技' | '待客'
export type SkillKey = ServingSkill | 'M性' | 'S性'
export type Inclination = '无' | 'M' | 'S' | '两面'
export type SensitivityZone = '耳朵' | '阴蒂' | '唇舌' | '乳房' | '小穴' | '后庭' | '种族'
export type SensitivityLevel = '迟钝' | '普通' | '敏感' | '弱点'
export type DesireKind = 'M' | 'S' | '中性'
export type DesireService = ServingSkill | '种族'
export type OutfitId = 'regular' | 'maid' | 'kimono' | 'crotchless' | 'restraint' | 'queen'
  | 'bunny' | 'qipao' | 'dancer' | 'babydoll' | 'sling' | 'nurse' | 'school' | 'miko' | 'nun' | 'bridal' | 'latex' | 'harness'
export type StockingId = 'none' | 'black' | 'white' | 'garter' | 'fishnet' | 'lace_white'
export type OutfitPref = '制服' | '和服' | '黑丝' | '白丝' | '暴露' | '想施虐的客人' | '想被榨的客人' | '兔女郎' | '异域' | '圣洁'
export type TrainingDirection = 'tame' | 'release' | 'sculpt' | 'drill' | 'sensitize' | 'punish'
/** 可购买的调教场景（设备）；缺省 = 普通调教室 */
export type SceneId = 'dungeon' | 'water' | 'stage' | 'machine' | 'tentacle' | 'hypnosis' | 'altar' | 'onsen' | 'queen_room' | 'throne' | 'cradle'
/** 某魔物娘在某场景上的累积：最近使用日（≤7 条）、性癖积累、阴影积累 */
export interface SceneState { uses: number[]; fp: number; sp: number }

/** 魔物娘身上的未处理事件（阶段 10） */
export interface Incident { kind: '接客失败' | '闯祸'; text: string; day: number }

// ─── 游戏类型 ─────────────────────────────────────────────────────────────────

export interface Player {
  name: string
  /** 店铺主题（经营页）；null/缺省 = 无主题 */
  storeTheme?: string | null
  /** 上次改主题的天数（冷却） */
  storeThemeDay?: number
  traits: string[]
  customTraits: string
  fetishes: string[]
  gold: number
  day: number
  guestPreference: string
  marketPreference: string
  // 娼馆等级：升级提升魔物娘持有上限与每日客人上限（旧存档缺省视为 1）
  level?: number
  // 声望：由客人满意度累积，提升每日客人的预算/质量（旧存档缺省视为 0）
  reputation?: number
  // ─── 经营设施（旧存档由 migrate-save 回填为 1） ───
  dormLevel?: number          // 宿舍 1 通铺 / 2 软床 / 3 浴场 / 4 单间
  serviceRoomLevel?: number   // 服务房间 1–4，只决定额外 play 槽
  trainingRoomLevel?: number  // 调教室 1–4，决定倍率与道具槽
  wardrobe?: string[]         // 已购衣橱 id（主装与丝袜；常服自带，不记入）
  inventory?: Record<string, number> // 道具 id → 数量（恢复药 / 塑形药）
  ownedTrainingProps?: string[]      // 已购调教道具 id
  customProps?: CustomProp[]         // 定制调教道具（全馆最多 6 件）
  stepActions?: string[]             // 旧：五步「标准做法」馆主自定义（v4 起迁移进 serviceFlows 的「标准」模板）
  serviceFlows?: ServiceFlow[]       // 服务流程模板（最多 5 个；只影响叙述与推荐，不计分）
  defaultFlowId?: string             // 全馆默认流程
  giftGivenOnDay?: number     // 当天已送礼（全馆每天一次）
  ownedScenes?: SceneId[]     // 已购调教场景（每天收维护费）
}

/** 服务流程模板：名字 + 五步做法（空串 = 用默认文字）+ 偏好 play（挂在某一步） */
export interface ServiceFlow {
  id: string
  name: string
  actions: string[]
  plays?: { step: number; playId: string }[]
}

export interface MonstGirl {
  id: string
  name: string
  race: string
  age: string
  bodyDesc: string
  bodyTags: string
  bust: number
  waist: number
  hip: number
  personality: string
  personalityTags: string
  /** 口癖：自称 / 称呼 / 语气与句尾 / 招牌台词（多行文本；旧存档与自建角色可为空） */
  speechStyle?: string
  outfit: string
  outfitTags: string
  otherDesc: string
  otherTags: string
  sexualDesc?: string
  // 数值
  affection: number
  obedience: number
  lewdness: number
  skills: string[]  // 旧技能名（口技/手技…）：仅为兼容旧存档保留，不再展示、不进 prompt、不参与结算
  // ─── 新结算字段（全部可选，旧存档由 migrate-save 回填） ───
  stamina?: number                              // 体力 0–100，跨天保留
  exhausted?: boolean                           // 疲惫
  stepActions?: string[]             // 五步「标准做法」按魔物娘覆盖（优先于馆主）
  incident?: Incident | null         // 未处理事件（每人最多一条）
  /** 技能熟练度 0–100（UX 8）：有它时档位、倾向都由它推出；旧字段 skillRanks / msProgress / skillProgress 只在迁移时读 */
  proficiency?: Partial<Record<SkillKey, number>>
  skillRanks?: Partial<Record<SkillKey, SkillRank>> // 旧版：服侍技能 / M性 / S性 → 档位
  inclination?: Inclination                     // 无 / M / S / 两面
  msProgress?: { m: number; s: number }         // 驯服积累 M、放权积累 S
  skillProgress?: Partial<Record<SkillKey, number>> // 特训进度
  sensitivities?: Partial<Record<SensitivityZone, number>> // 六条共通带 + 种族带，0–100
  sculptCounts?: { bust: number; waist: number; hip: number } // 各项塑形次数（涨价）
  itemUsedOnDay?: number                        // 当天已用过恢复药（每人每天一瓶）
  provokedDays?: number[]  // 激发阴影的日子（≤7 条；只在调教里用）
  sceneState?: Partial<Record<SceneId, SceneState>> // 调教场景：使用记录 / 性癖积累 / 阴影
  awakened?: SceneId[]                          // 已觉醒的性癖（按场景记，名字见 TRAINING_SCENES）
  memory?: import('./girl-memory').GirlMemory   // 她自己的记忆（事件 + 心里话）
  // 图片缓存
  imageTags: string
  imageUrl?: string
  // 市场
  price?: number
}

export interface GuestGirlMemory {
  // 客人对该魔物娘的印象（一句话）
  guestAboutGirl: string
  // 魔物娘对该客人的印象（一句话）
  girlAboutGuest: string
  // 历史服务次数
  visitCount: number
}

export interface Guest {
  id: string
  name: string
  race: string
  personality: string
  traits: string[]
  desires: string
  imageTags: string
  imageUrl?: string
  satisfaction: number
  // 关系记忆：key 为魔物娘名字
  memories?: Record<string, GuestGirlMemory>
  // 该客人的基础付费预算（随声望提升；旧数据缺省按基准值）
  budget?: number
  // 在本馆累计被接待的次数（回头客每次回访付费递增）
  visits?: number
  // 偏好：开场时若在场魔物娘命中，给予初始满意度加成
  prefRace?: string   // 偏好种族（命中在场任一魔物娘的种族）
  prefTrait?: string  // 偏好特征（巨乳/贫乳/丰臀/兽耳…，对魔物娘属性可判定）
  desireKind?: DesireKind        // M（想施虐）/ S（想被榨）/ 中性
  desireService?: DesireService  // 主需求类型
  prefOutfit?: OutfitPref | null // 服装喜好；约一半客人为 null
  guestClass?: GuestClass        // 身份档（缺省 = 平民）
  demand?: number                // 挑剔度：结算满意度直接扣这么多
  desireDetail?: string          // AI 润色的需求细节（只做文案；判定仍看 desires）
  aiFlavored?: boolean           // 已由 AI 润色过
}

export type GuestClass = 'commoner' | 'merchant' | 'adventurer' | 'noble' | 'captain'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** 自动转场：这条 user 是发给模型的转场指令，界面只显示一条分隔线（label） */
  hidden?: boolean
  label?: string
}

export interface ParticipantStats {
  pleasure: number
  stamina: number
  isExhausted: boolean
}

export interface ServiceSession {
  type: 'service' | 'training'
  guest?: Guest
  trainer?: MonstGirl
  girls: MonstGirl[]
  messages: ChatMessage[]
  girlsStats: Record<string, ParticipantStats>
  guestStats?: ParticipantStats
  trainerStats?: ParticipantStats
}

export type GamePhase =
  | 'morning'
  | 'service'
  | 'training'
  | 'market'
  | 'interaction'

export interface GameSave {
  player: Player
  girls: MonstGirl[]
  currentDay: number
  phase: GamePhase
  activeSession?: ServiceSession
  // 当天已进行的行动次数（接客/调教），每天上限 MAX_ACTIONS_PER_DAY（旧存档缺省视为 0）
  actionsUsedToday?: number
  // 当天开始时一次性随机生成好的客人池；接待后从池中移除（旧存档缺省回填）
  dailyGuests?: Guest[]
  // 回头客池：高满意度服务后沉淀的常客，未来有概率混入每日客人池并带着关系记忆回访
  regulars?: Guest[]
  // 单间宿舍指定的额外回复对象
  bestBedGirlId?: string
  // 今天已出场（接客/调教）的魔物娘 id，结束今天时清空
  appearedToday?: string[]
  // 存档格式版本（缺省 = 0，旧存档），由 migrateSave 升到 SAVE_VERSION
  saveVersion?: number
  // 第一天新手引导：当前步骤（0 起），关闭/跳过后 dismissed=true
  tutorial?: { step: number; dismissed: boolean }
  // 当天账本（结束今天时生成小结后重开）
  dayLog?: import('./day-summary').DayLog
  // 上一天的小结，大厅弹卡展示，关闭即置 null
  lastDaySummary?: import('./day-summary').DaySummary | null
  // AI 润色客人已尝试过的那一天（成功或失败都记，刷新不重复请求）
  aiGuestsDay?: number
  /** 今天「换一批客人」用了几次 */
  guestRefresh?: { day: number; count: number }
  // 今晚挂在机械调教室过夜的魔物娘（结束今天时结算并清空）
  machineNightGirlId?: string
}

/** 定制调教道具：名字、描述自填，效果来自固定模板 */
export interface CustomProp { id: string; name: string; desc: string; templateId: string }
