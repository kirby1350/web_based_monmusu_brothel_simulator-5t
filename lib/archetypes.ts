// 8 开店设定：开局类型（金币、设施/场景、初始主题、两位姑娘）+ 难度
import type { GameSave, MonstGirl, OutfitId, Player, SceneId } from './types'
import { GIRL_TEMPLATES, GIRL_TEMPLATE_IMAGES } from './game-data'
import { withInitialProficiency } from './proficiency'
import { THEME_COOLDOWN_DAYS } from './store-theme'

export interface Archetype {
  id: string
  label: string
  desc: string
  gold: number
  serviceRoomLevel?: number
  trainingRoomLevel?: number
  scenes?: SceneId[]
  wardrobe?: OutfitId[]
  theme?: string
  /** 两位开局姑娘（预设名）；空 = 自己创建第一位 + 三选一第二位 */
  girls: string[]
}

export const ARCHETYPES: Archetype[] = [
  { id: 'busty', label: '巨乳名店', desc: '两头牛娘般的大姐姐坐镇，服务房间已是 2 级（1 个 play 槽），衣橱里有女仆装。主题「巨乳」。',
    gold: 400, serviceRoomLevel: 2, wardrobe: ['maid'], theme: '巨乳', girls: ['千雪', '爱宕'] },
  { id: 'dungeon', label: '调教馆', desc: '调教室 2 级、自带拘束地牢；两位都还不太听话，得先调教再接客。主题「M 系」。',
    gold: 350, trainingRoomLevel: 2, scenes: ['dungeon'], theme: 'M系', girls: ['赤城', '柴郡'] },
  { id: 'exotic', label: '异种乐园', desc: '蜘蛛娘与拉米亚，一个用丝、一个用尾；衣橱里有舞娘纱衣。主题「异种」。',
    gold: 450, wardrobe: ['dancer'], theme: '异种', girls: ['文香', '志希'] },
  { id: 'balanced', label: '均衡开局', desc: '什么都没有，但 500G 全在手上；第一位姑娘自己创建，第二位三选一。',
    gold: 500, girls: [] },
]

export interface Difficulty { id: string; label: string; desc: string; goldMult: number; reputation: number; demand: number }
export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', label: '轻松', desc: '开局金币 ×1.5、声望 10；客人不额外挑剔。', goldMult: 1.5, reputation: 10, demand: 0 },
  { id: 'normal', label: '标准', desc: '原版平衡。', goldMult: 1, reputation: 0, demand: 0 },
  { id: 'hard', label: '严苛', desc: '开局金币 ×0.6；每位新客人都更挑剔（满意度 −3）。', goldMult: 0.6, reputation: 0, demand: 3 },
]
export const getArchetype = (id?: string) => ARCHETYPES.find((a) => a.id === id) ?? ARCHETYPES[3]
export const getDifficulty = (id?: string) => DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]

/** 预设名 → 带立绘与初始熟练度的姑娘 */
export function presetGirl(name: string, id: string): MonstGirl | null {
  const idx = GIRL_TEMPLATES.findIndex((t) => t.name === name)
  if (idx < 0) return null
  return withInitialProficiency({ ...(GIRL_TEMPLATES[idx] as MonstGirl), id, imageUrl: GIRL_TEMPLATE_IMAGES[idx] ?? undefined, stamina: 100 })
}
export function archetypeGirls(a: Archetype, newId: () => string): MonstGirl[] {
  return a.girls.map((n) => presetGirl(n, newId())).filter((g): g is MonstGirl => !!g)
}

/** 把开局类型与难度落到馆主身上（金币、声望、设施、场景、衣橱、主题——开局主题可以马上改） */
export function applyArchetype(player: Player, a: Archetype, d: Difficulty): Player {
  return {
    ...player,
    gold: Math.round(a.gold * d.goldMult),
    reputation: d.reputation,
    archetype: a.id,
    difficulty: d.id,
    ...(a.serviceRoomLevel ? { serviceRoomLevel: a.serviceRoomLevel } : {}),
    ...(a.trainingRoomLevel ? { trainingRoomLevel: a.trainingRoomLevel } : {}),
    ...(a.scenes ? { ownedScenes: a.scenes } : {}),
    ...(a.wardrobe ? { wardrobe: a.wardrobe } : {}),
    ...(a.theme ? { storeTheme: a.theme, storeThemeDay: 1 - THEME_COOLDOWN_DAYS } : {}),
  }
}
/** 难度的客人挑剔度（新客人生成时加到 demand 上） */
export function difficultyDemand(save: Pick<GameSave, 'player'>): number {
  return getDifficulty(save.player.difficulty).demand
}
