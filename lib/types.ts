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

// DZMM/gpt4novel v2 模型列表返回的单条模型
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
  { value: 'Apex-Neo-0213-16k', label: 'Apex-Neo-0213-16k', group: '其他', provider: 'default' },
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

// ─── 游戏类型 ─────────────────────────────────────────────────────────────────

export interface Player {
  name: string
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
  outfit: string
  outfitTags: string
  otherDesc: string
  otherTags: string
  sexualDesc?: string
  // 数值
  affection: number
  obedience: number
  lewdness: number
  skills: string[]
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
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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
}
