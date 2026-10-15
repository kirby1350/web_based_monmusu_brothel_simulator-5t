// 调教场景（设备）：一次性购买 + 小额每日维护费；对口方向时给固定加成（不吃调教室倍率）。
// 频繁使用会让她觉醒对应性癖（场景变成「喜欢」）；抗拒的种族则积累阴影（软代价，不做恶堕）。
import type { GameSave, Guest, MonstGirl, SceneId, SceneState, TrainingDirection } from './types'
import { getGuestProfile } from './catalog'

export interface SceneUnlock { trainingRoom?: number; reputation?: number; dorm?: number; orRaces?: string[] }
export interface SceneDef {
  id: SceneId
  name: string
  price: number
  /** 每日维护费（结束今天时扣） */
  upkeep: number
  directions: TrainingDirection[]
  /** 可觉醒的性癖 */
  fetish: string
  /** 性癖进提示词时的一句说明 */
  fetishDesc: string
  affinity: string[]
  aversion: string[]
  unlock: SceneUnlock
  /** 基础好感变化（负数 = 代价；温泉为正） */
  affection: number
  /** 在默认调教体力 20 之外再加（温泉为 −10） */
  staminaExtra: number
  /** 商店 / 准备页的一句效果说明 */
  effect: string
  desc: string
  /** 叙事提示词里的「地点」 */
  place: string
  /** 图片标签 */
  tags: string
  /** 叙事提示：这一场由谁主导（放权场景：她主导） */
  roleNote?: string
}

export const TRAINING_SCENES: SceneDef[] = [
  {
    id: 'dungeon', name: '拘束地牢', price: 600, upkeep: 1, directions: ['tame', 'punish'],
    fetish: '拘束癖', fetishDesc: '被锁住、动弹不得时反而最安心也最湿',
    affinity: ['犬娘'], aversion: ['狼娘'], unlock: {}, affection: -2, staminaExtra: 0,
    effect: '驯服/惩罚：服从 +4、M性 +4；好感 −2',
    desc: '铁链、木枷与一只刚好容得下她的铁笼，石墙上还留着前人挣扎的抓痕。',
    place: '娼馆地下的拘束地牢，潮冷的石墙上挂满铁链与木枷，角落立着一只刚好容得下一人的铁笼，火把把影子拉得很长',
    tags: 'dungeon, chains, shackles, stocks, cage, stone wall, torch light',
  },
  {
    id: 'water', name: '水牢', price: 800, upkeep: 2, directions: ['punish', 'tame'],
    fetish: '受虐癖', fetishDesc: '越是冰冷难熬的折磨，越能让她颤抖着高潮',
    affinity: ['史莱姆'], aversion: ['哈比', '吸血鬼'], unlock: { trainingRoom: 2 }, affection: -4, staminaExtra: 15,
    effect: '惩罚/驯服：服从 +5（惩罚处理事件再 +2）；好感 −4、体力 +15',
    desc: '齐腰深的冷水池，手腕吊在水面上方，只能踮着脚尖求饶。',
    place: '娼馆最底层的水牢，齐腰深的冷水泛着幽光，她的手腕被铁链吊在水面上方，只能踮着脚尖维持呼吸',
    tags: 'water prison, partially submerged, wet, wet hair, chains, hanging, dark',
  },
  {
    id: 'stage', name: '公开调教台', price: 900, upkeep: 2, directions: ['tame', 'release'],
    fetish: '露出癖', fetishDesc: '被众人注视时会兴奋得发抖，越羞耻越想被看',
    affinity: ['魔女', '黑暗精灵'], aversion: ['精灵', '龙娘'], unlock: { reputation: 30 }, affection: -4, staminaExtra: 0,
    effect: '驯服：服从 +4、淫乱 +2｜放权：淫乱 +4、服从 +2；每场声望 +1；好感 −4',
    desc: '大厅正中的圆台，四面都是客人的目光——这也是一种招牌。',
    place: '娼馆大厅正中的圆形展示台，烛光聚焦在她身上，四周围满了喝酒起哄的客人，每一个动作都暴露在众目睽睽之下',
    tags: 'public, stage, spotlight, crowd, audience, exhibitionism',
  },
  {
    id: 'machine', name: '机械调教室', price: 1000, upkeep: 2, directions: ['tame', 'sensitize'],
    fetish: '器具癖', fetishDesc: '对冰冷规律的器械刺激毫无抵抗力，一听到机括声就腿软',
    affinity: ['牛娘'], aversion: ['哈比', '狐娘'], unlock: { trainingRoom: 2 }, affection: 0, staminaExtra: 10,
    effect: '驯服：服从 +6｜敏感开发：对口 +6；体力 +10；可夜间挂机',
    desc: '魔晶驱动的木马、炮机与榨乳器，不知疲倦，也不懂怜悯。',
    place: '娼馆的机械调教室，魔晶驱动的三角木马、往复炮机与榨乳器嗡嗡作响，齿轮与皮带一刻不停',
    tags: 'sex machine, wooden horse, mechanical, restrained, milking machine, gears',
  },
  {
    id: 'tentacle', name: '触手房', price: 1200, upkeep: 2, directions: ['tame', 'release', 'sensitize'],
    fetish: '触手癖', fetishDesc: '被黏滑的触手缠满全身时会彻底放空，主动张开身体迎接',
    affinity: ['史莱姆', '拉米亚', '蜘蛛娘'], aversion: ['龙娘'], unlock: { trainingRoom: 3 }, affection: -3, staminaExtra: 15,
    effect: '驯服：服从 +8、淫乱 +3｜放权：淫乱 +8｜敏感开发：对口 +4、最低的共通带 +3；好感 −3、体力 +15',
    desc: '饲养着魔界触手的温室，黏液与甜腥的花香让人一进门就发软。',
    place: '娼馆深处的触手温室，墙壁与地面爬满蠕动的魔界触手，空气里是黏液与甜腥花香，触手会自己寻找身体上每一个孔与敏感处',
    tags: 'tentacles, tentacle restraint, slime, wrapped, suspended, organic room',
  },
  {
    id: 'hypnosis', name: '催眠室', price: 1400, upkeep: 3, directions: ['tame', 'drill'],
    fetish: '催眠癖', fetishDesc: '一听到摆锤声或某个口令就眼神放空、乖乖服从，并以此为乐',
    affinity: ['犬娘'], aversion: ['狐娘', '魔女'], unlock: { trainingRoom: 3, orRaces: ['魔女', '狐娘'] }, affection: 0, staminaExtra: 0,
    effect: '驯服：服从 +10、好感不降（前一天刚催眠过减半）｜特训：熟练度 +6',
    desc: '紫水晶摆锤与安神香，醒来时她只会记得一场模糊的梦。',
    place: '娼馆的催眠室，紫水晶摆锤在烛光里缓缓摇晃，安神香让空气变得黏稠，她的眼神正一点点失去焦点',
    tags: 'hypnosis, empty eyes, spiral eyes, pendulum, purple light, dazed',
  },
  {
    id: 'altar', name: '淫纹祭坛', price: 1600, upkeep: 3, directions: ['release', 'sensitize'],
    fetish: '淫纹依存', fetishDesc: '小腹的淫纹一发光就会发情，离开淫纹的刺激反而难以满足',
    affinity: ['魔女', '吸血鬼'], aversion: [], unlock: { reputation: 50 }, affection: -2, staminaExtra: 0,
    effect: '放权：淫乱 +8｜敏感开发：其余共通带各 +2；好感 −2；穿修女服/婚纱加成减半',
    desc: '刻满魔法阵的黑石祭坛，淫纹会在她小腹上一层层亮起。',
    place: '娼馆暗室里的淫纹祭坛，黑石台面刻满发光的魔法阵，她小腹上的淫纹随咒文一层层亮起、发烫',
    tags: 'magic circle, glowing womb tattoo, pubic tattoo, altar, dark magic, glowing runes',
  },
  {
    id: 'onsen', name: '温泉恩宠间', price: 700, upkeep: 1, directions: ['tame', 'release'],
    fetish: '甘宠癖', fetishDesc: '被温柔宠着时会彻底融化，撒娇讨抱、离不开馆主的手',
    affinity: ['牛娘', '精灵', '狐娘'], aversion: ['史莱姆'], unlock: { dorm: 3 }, affection: 5, staminaExtra: -10,
    effect: '好感 +5，服从或淫乱 +3；体力只耗 10；每次让她所有阴影 −1',
    desc: '引温泉水入室的小间，热气、花瓣和只属于你们两人的时间。',
    place: '娼馆浴场旁的温泉恩宠间，热气氤氲，水面漂着花瓣，只有馆主和她两个人',
    tags: 'onsen, hot spring, steam, wet skin, petals, gentle, embrace',
  },
  // ── 放权（S 侧）场景：她来主导，涨 S性 ──
  {
    id: 'queen_room', name: '女王调教室', price: 800, upkeep: 1, directions: ['release'],
    fetish: '女王癖', fetishDesc: '让人跪在脚边、听她发号施令时会兴奋得发烫，越被顺从越想要更多',
    affinity: ['黑暗精灵', '吸血鬼', '魔女'], aversion: ['兔娘', '史莱姆'], unlock: { trainingRoom: 2 }, affection: 1, staminaExtra: 0,
    effect: '放权：S性 +8、淫乱 +3；好感 +1',
    desc: '黑红天鹅绒、高背皮椅和一排任她挑选的短鞭与项圈——这间屋子里，她说了算。',
    place: '娼馆里布置成女王寝殿的调教室，黑红天鹅绒帷幔、高背皮椅与脚凳，墙上挂着一排任她挑选的短鞭、项圈与牵绳',
    tags: 'femdom, dominatrix, leather, high heels, riding crop, red velvet, sitting on chair, looking down',
    roleNote: '这一场由她主导：她坐在高背椅上居高临下地发号施令、决定节奏与奖惩，馆主配合她',
  },
  {
    id: 'throne', name: '王座间', price: 1500, upkeep: 2, directions: ['release'],
    fetish: '支配欲', fetishDesc: '看着别人在自己面前低头时会满足得发抖，渴望被仰望、被侍奉',
    affinity: ['龙娘', '拉米亚', '蜘蛛娘'], aversion: ['犬娘', '哈比'], unlock: { reputation: 40, orRaces: ['龙娘', '吸血鬼'] }, affection: 0, staminaExtra: 5,
    effect: '放权：S性 +10、淫乱 +2；每场声望 +1；体力 +5；服从 <30 时可能恃宠而骄',
    desc: '大厅尽头垫高的黑曜石王座，台阶下是供人跪拜的软垫，客人们会来瞻仰新女王。',
    place: '娼馆大厅尽头的王座间，九级台阶上是一张黑曜石王座，猩红地毯一路铺到台阶下供人跪拜的软垫，几位熟客远远地垂首候着',
    tags: 'throne, queen, crown, sitting on throne, crossed legs, looking down, red carpet, from below',
    roleNote: '这一场由她主导：她端坐王座，被仰望、被侍奉，命令馆主与台下的人；写出她第一次尝到支配滋味时的高昂',
  },
]

export const DIRECTION_LABEL: Record<TrainingDirection, string> = { tame: '驯服', release: '放权', sculpt: '塑形', drill: '特训', sensitize: '敏感开发', punish: '惩罚' }

export const SCENE_IDS = TRAINING_SCENES.map((s) => s.id)
export const getScene = (id?: SceneId | null): SceneDef | undefined => TRAINING_SCENES.find((s) => s.id === id)

/** 性癖觉醒：积累 ≥8 且淫乱 ≥40 */
export const FETISH_THRESHOLD = 8
export const FETISH_MIN_LEWD = 40
/** 阴影：积累 ≥3 生效 */
export const SHADOW_THRESHOLD = 3
/** 递减窗口与系数：7 天内第 n 次（之前已用 n−1 次） */
export const SCENE_WINDOW_DAYS = 7
export const SCENE_DECAY = [1, 0.85, 0.7, 0.6]
export const AWAKENED_DECAY_FLOOR = 0.85
export const AFFINITY_MAIN_BONUS = 2
export const AVERSION_MAIN_PENALTY = 2
export const AVERSION_AFFECTION = -3
export const SHADOW_AFFECTION = -2
export const MACHINE_NIGHT_OBEDIENCE = 3
/**
 * 激发阴影（只在调教里起作用；不影响接客、不产生闯祸；不是菜单选项）：
 * - 对话：她有阴影时，馆主的话触到阴影（在阴影场景里说到相关字眼，或在别处点名那个场景）→ 自动激发；
 * - 跳过：在阴影场景里跳过调教，按阴影层数掷骰（浅 40% / 深 65% / 刻骨 90%）。
 * 效果：服从 +8 +2×(层数−1)，7 天内第 n 次 ×[1, 0.6, 0.35]；体力再 +15；不扣好感；阴影积累 +2；
 * 这一场不长性癖积累；激发过的第二天不会再被激发（连续两天不行）。
 */
export const PROVOKE_OBEDIENCE = 8
export const PROVOKE_LEVEL_BONUS = 2
export const PROVOKE_DECAY = [1, 0.6, 0.35]
export const PROVOKE_STAMINA = 15
export const PROVOKE_DEEPEN = 2
/** 跳过时按阴影层数的激发概率（下标 = 层数） */
export const SKIP_PROVOKE_CHANCE = [0, 0.4, 0.65, 0.9]
/**
 * 对话触发词：names = 点名这个场景（在任何场景里说都算）；words = 只在这个场景里说才算的相关字眼。
 */
export const SHADOW_TRIGGERS: Record<SceneId, { names: string[]; words: string[] }> = {
  dungeon: { names: ['地牢'], words: ['锁链', '铁链', '镣铐', '枷', '拘束', '绑起', '捆', '吊起', '铁笼'] },
  water: { names: ['水牢'], words: ['淹', '浸', '憋气', '冷水', '沉下去', '水里', '水面', '泡着'] },
  stage: { names: ['调教台', '公开调教'], words: ['当众', '围观', '观众', '示众', '大家都在看', '看着你', '台上'] },
  machine: { names: ['机械调教', '机器', '机械'], words: ['机括', '马达', '器械', '活塞', '震动', '开关', '档位', '转速'] },
  tentacle: { names: ['触手'], words: ['黏液', '缠住', '缠上', '吸盘', '蠕动', '缠绕'] },
  hypnosis: { names: ['催眠'], words: ['摆锤', '怀表', '看着我的眼睛', '睡吧', '放空', '指令', '响指'] },
  altar: { names: ['淫纹', '祭坛'], words: ['刻印', '纹路', '发烫', '发光', '咒文', '烙'] },
  onsen: { names: ['温泉'], words: ['热水', '泡汤', '水汽', '池子'] },
  queen_room: { names: ['女王调教室', '女王'], words: ['跪下', '脚凳', '短鞭', '项圈', '命令我', '舔干净'] },
  throne: { names: ['王座'], words: ['陛下', '臣服', '跪拜', '仰望', '王冠', '台阶'] },
}
/** 阴影层数：积累 3/6/9 → 1/2/3 层 */
export const SHADOW_LEVEL_STEP = 3
export const SHADOW_MAX_LEVEL = 3
export const FETISH_GREET_BONUS = 2

// ─── 解锁 / 维护 ──────────────────────────────────────────────────────────────

export function unlockText(u: SceneUnlock): string {
  const parts = [
    u.trainingRoom ? `调教室 Lv${u.trainingRoom}` : '', u.reputation ? `声望 ${u.reputation}` : '', u.dorm ? `宿舍 Lv${u.dorm}` : '',
  ].filter(Boolean)
  const base = parts.join('、')
  return u.orRaces?.length ? `${base}，或馆里有${u.orRaces.join('/')}` : base
}

export function sceneUnlocked(save: GameSave, id: SceneId): boolean {
  const def = getScene(id)
  if (!def) return false
  const u = def.unlock, p = save.player
  if (u.orRaces?.length && save.girls.some((g) => u.orRaces!.includes(g.race))) return true
  return (p.trainingRoomLevel ?? 1) >= (u.trainingRoom ?? 0) && (p.reputation ?? 0) >= (u.reputation ?? 0) && (p.dormLevel ?? 1) >= (u.dorm ?? 0)
}

export function ownsScene(save: GameSave, id: SceneId): boolean {
  return (save.player.ownedScenes ?? []).includes(id)
}

/** 已购场景的每日维护费合计 */
export function sceneUpkeep(player: GameSave['player']): number {
  return (player.ownedScenes ?? []).reduce((a, id) => a + (getScene(id)?.upkeep ?? 0), 0)
}

// ─── 她对场景的反应 ───────────────────────────────────────────────────────────

export type SceneReaction = 'awakened' | 'affinity' | 'aversion' | 'neutral'

export function sceneReaction(girl: Pick<MonstGirl, 'race' | 'awakened'>, id: SceneId): SceneReaction {
  const def = getScene(id)
  if (!def) return 'neutral'
  if (girl.awakened?.includes(id)) return 'awakened'
  if (def.affinity.includes(girl.race)) return 'affinity'
  if (def.aversion.includes(girl.race)) return 'aversion'
  return 'neutral'
}

export const REACTION_LABEL: Record<SceneReaction, string> = { awakened: '已觉醒', affinity: '亲和', aversion: '抗拒', neutral: '' }

const stateOf = (girl: Pick<MonstGirl, 'sceneState'>, id: SceneId): SceneState => girl.sceneState?.[id] ?? { uses: [], fp: 0, sp: 0 }

/** 7 天窗口内（day−6 … day）已经用过几次 */
export function recentUses(girl: Pick<MonstGirl, 'sceneState'>, id: SceneId, day: number): number {
  return stateOf(girl, id).uses.filter((d) => d > day - SCENE_WINDOW_DAYS && d <= day).length
}

export function sceneDecay(girl: Pick<MonstGirl, 'sceneState' | 'awakened'>, id: SceneId, day: number): number {
  const f = SCENE_DECAY[Math.min(recentUses(girl, id, day), SCENE_DECAY.length - 1)]
  return girl.awakened?.includes(id) ? Math.max(f, AWAKENED_DECAY_FLOOR) : f
}

export function usedYesterday(girl: Pick<MonstGirl, 'sceneState'>, id: SceneId, day: number): boolean {
  return stateOf(girl, id).uses.includes(day - 1)
}

export function hasShadow(girl: Pick<MonstGirl, 'sceneState' | 'awakened'>, id: SceneId): boolean {
  return !girl.awakened?.includes(id) && stateOf(girl, id).sp >= SHADOW_THRESHOLD
}

/** 阴影层数 0–3（0 = 没有阴影） */
export function shadowLevel(girl: Pick<MonstGirl, 'sceneState' | 'awakened'>, id: SceneId): number {
  if (!hasShadow(girl, id)) return 0
  return Math.min(SHADOW_MAX_LEVEL, Math.floor(stateOf(girl, id).sp / SHADOW_LEVEL_STEP))
}

export const SHADOW_LEVEL_LABEL = ['', '浅', '深', '刻骨']

/** 7 天内已激发过几次 */
export function recentProvokes(girl: Pick<MonstGirl, 'provokedDays'>, day: number): number {
  return (girl.provokedDays ?? []).filter((d) => d > day - SCENE_WINDOW_DAYS && d <= day).length
}

/** 这个阴影现在能不能被激发；能则 null，否则原因 */
export function provokeBlock(girl: Pick<MonstGirl, 'sceneState' | 'awakened' | 'provokedDays'>, scene: SceneId | undefined, day: number): string | null {
  if (!scene || !hasShadow(girl, scene)) return '她在这里没有阴影'
  const pd = girl.provokedDays ?? []
  if (pd.includes(day)) return '今天已经激发过了'
  if (pd.includes(day - 1)) return '昨天刚激发过，她撑不住连续两天'
  return null
}

/** 激发阴影的服从加成（按当前阴影层数与本周次数）；不扣好感 */
export function provokeEffect(girl: Pick<MonstGirl, 'sceneState' | 'awakened' | 'provokedDays'>, scene: SceneId, day: number): { obedience: number; stamina: number; level: number; decay: number } {
  const level = Math.max(1, shadowLevel(girl, scene))
  const decay = PROVOKE_DECAY[Math.min(recentProvokes(girl, day), PROVOKE_DECAY.length - 1)]
  return {
    obedience: Math.round((PROVOKE_OBEDIENCE + PROVOKE_LEVEL_BONUS * (level - 1)) * decay),
    stamina: PROVOKE_STAMINA,
    level, decay,
  }
}

/**
 * 对话触发：馆主这句话有没有触到她的阴影。返回被触到的阴影场景（不能激发时 null）。
 * - 当前场景本身有阴影：场景名或相关字眼都算；
 * - 当前场景没有阴影（或普通调教室）：只有点名某个阴影场景才算。
 */
export function detectShadowTrigger(girl: Pick<MonstGirl, 'sceneState' | 'awakened' | 'provokedDays'>, scene: SceneId | undefined, text: string, day: number): SceneId | null {
  const t = text.replace(/\s+/g, '')
  if (!t) return null
  const here = scene && hasShadow(girl, scene) ? scene : undefined
  if (here) {
    const tr = SHADOW_TRIGGERS[here]
    if ([...tr.names, ...tr.words, getScene(here)!.name].some((w) => t.includes(w))) return provokeBlock(girl, here, day) ? null : here
  }
  for (const id of shadowScenes(girl)) {
    if (id === here) continue
    if ([...SHADOW_TRIGGERS[id].names, getScene(id)!.name].some((w) => t.includes(w))) return provokeBlock(girl, id, day) ? null : id
  }
  return null
}

/** 跳过时是否激发（只看本场所在场景的阴影；按层数掷骰）；rng 只在可能触发时消耗 */
export function rollSkipProvoke(girl: Pick<MonstGirl, 'sceneState' | 'awakened' | 'provokedDays'>, scene: SceneId | undefined, day: number, rng: () => number = Math.random): SceneId | null {
  if (!scene || provokeBlock(girl, scene, day)) return null
  return rng() < SKIP_PROVOKE_CHANCE[shadowLevel(girl, scene)] ? scene : null
}

/** 加深某个场景的阴影（激发发生在别的场景时用） */
export function deepenShadow(girl: MonstGirl, id: SceneId, n = PROVOKE_DEEPEN): MonstGirl {
  const cur = stateOf(girl, id)
  return { ...girl, sceneState: { ...(girl.sceneState ?? {}), [id]: { ...cur, sp: cur.sp + n } } }
}

export function shadowScenes(girl: Pick<MonstGirl, 'sceneState' | 'awakened'>): SceneId[] {
  return SCENE_IDS.filter((id) => hasShadow(girl, id))
}

export function fetishProgress(girl: Pick<MonstGirl, 'sceneState'>, id: SceneId): number {
  return stateOf(girl, id).fp
}

/** 一次使用带来的性癖积累 / 阴影积累 */
export function sceneGain(girl: Pick<MonstGirl, 'race' | 'awakened' | 'lewdness'>, id: SceneId): { fp: number; sp: number } {
  const r = sceneReaction(girl, id)
  if (r === 'awakened') return { fp: 0, sp: 0 }
  if (r === 'aversion') return { fp: girl.lewdness >= 70 ? 1 : 0, sp: 1 }
  return { fp: 1 + (girl.lewdness >= 50 ? 1 : 0) + (r === 'affinity' ? 1 : 0), sp: 0 }
}

export interface AccumulateResult { girl: MonstGirl; awakenedNow: boolean; shadowNow: boolean; fpGain: number; spGain: number }

/**
 * 记一次场景使用：使用日、性癖积累、阴影积累；够条件就觉醒（清掉该场景阴影）。
 * 温泉：她所有场景的阴影各 −1。lewdness 用结算后的值。
 */
export function accumulateScene(girl: MonstGirl, id: SceneId, day: number, opts: { provoke?: boolean; noFetish?: boolean } = {}): AccumulateResult {
  const cur = stateOf(girl, id)
  // 激发阴影：这一场只有恐惧，不长性癖，阴影加深（激发的是别处的阴影时：这里照常记阴影，但不长性癖）
  const base = sceneGain(girl, id)
  const gain = opts.provoke ? { fp: 0, sp: PROVOKE_DEEPEN } : opts.noFetish ? { fp: 0, sp: base.sp } : base
  const uses = [...cur.uses, day].filter((d) => d > day - SCENE_WINDOW_DAYS).slice(-SCENE_WINDOW_DAYS)
  const st: SceneState = { uses, fp: cur.fp + gain.fp, sp: cur.sp + gain.sp }
  const hadShadow = hasShadow(girl, id)
  let sceneState: Partial<Record<SceneId, SceneState>> = { ...(girl.sceneState ?? {}), [id]: st }
  let awakened = girl.awakened ?? []
  let awakenedNow = false
  if (!awakened.includes(id) && st.fp >= FETISH_THRESHOLD && girl.lewdness >= FETISH_MIN_LEWD) {
    awakened = [...awakened, id]
    sceneState = { ...sceneState, [id]: { ...st, sp: 0 } }
    awakenedNow = true
  }
  if (id === 'onsen') {
    sceneState = Object.fromEntries(Object.entries(sceneState).map(([k, v]) => [k, { ...v!, sp: Math.max(0, v!.sp - 1) }])) as typeof sceneState
  }
  const next: MonstGirl = { ...girl, sceneState, awakened }
  return { girl: next, awakenedNow, shadowNow: !hadShadow && hasShadow(next, id), fpGain: gain.fp, spGain: gain.sp }
}

// ─── 性癖 ─────────────────────────────────────────────────────────────────────

export const fetishName = (id: SceneId): string => getScene(id)?.fetish ?? id

export function awakenedFetishes(girl: Pick<MonstGirl, 'awakened'>): SceneDef[] {
  return (girl.awakened ?? []).map((id) => getScene(id)).filter((d): d is SceneDef => !!d)
}

/** 觉醒性癖与客人口味是否对上 */
export function fetishMatchesGuest(id: SceneId, guest: Guest): boolean {
  const p = getGuestProfile(guest)
  switch (id) {
    case 'dungeon': case 'water': case 'hypnosis': case 'tentacle': return p.kind === 'M'
    case 'altar': case 'queen_room': case 'throne': return p.kind === 'S'
    case 'stage': return guest.prefOutfit === '暴露'
    case 'machine': return /长时间|多次内射/.test(guest.desires ?? '')
    case 'onsen': return p.kind === '中性'
  }
}

/** 进提示词的性癖行（无则空串）：明确是后天觉醒、叠加在原性格之上 */
export function fetishPromptLine(girl: Pick<MonstGirl, 'awakened'>): string {
  const list = awakenedFetishes(girl)
  if (!list.length) return ''
  return `后天觉醒的性癖：${list.map((d) => `${d.fetish}（${d.fetishDesc}）`).join('；')}——这是叠加在她原有性格之上的新偏好，不要改变她的性格、自称与口癖`
}

// ─── 风险事件（结算时掷骰；不在预览里） ──────────────────────────────────────

export function sceneRiskIncident(
  id: SceneId | undefined, before: MonstGirl, after: MonstGirl, day: number, rng: () => number,
): { kind: '闯祸'; text: string; day: number } | null {
  if (!id || after.incident) return null
  if (id === 'stage' && before.affection < 30) return rng() < 0.25 ? { kind: '闯祸', text: '在公开调教台上当众顶撞了你，场面一度失控', day } : null
  if (id === 'tentacle' && (after.stamina ?? 100) === 0) return rng() < 0.2 ? { kind: '闯祸', text: '被触手房吓坏了，躲在被子里不肯出来', day } : null
  if (id === 'throne' && after.obedience < 30) return rng() < 0.2 ? { kind: '闯祸', text: '在王座上尝到了权力的滋味，回来后对你也颐指气使', day } : null
  if (id === 'hypnosis') return rng() < 0.1 ? { kind: '闯祸', text: '催眠反噬，整天发呆，还叫错了你的名字', day } : null
  return null
}
