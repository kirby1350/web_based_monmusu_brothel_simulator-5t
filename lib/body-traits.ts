// 体质特性（与性癖分开）：泌乳 / 敏感体质 / 发情期 / 媚药体质 / 扶她 / 乳量增大 / 淫纹。
// 来源：种族天生（永久）、长期调教觉醒（永久）、改造药剂（临时，按天数到期，解药可提前解除）。
// 存档只记后天得来的（girl.bodyTraits）；天生的按种族算，不存。
import type { MonstGirl, Guest } from './types'
import type { PlayDef } from './catalog'

export type BodyTraitId = 'lactation' | 'sensitive' | 'estrus' | 'aphro' | 'futa' | 'bigbust' | 'crest'
export type BodyTraitSource = 'innate' | 'potion' | 'awaken' | 'cheat'
/** 后天体质：expiresDay = 这一天开始失效（结束前一天时清掉）；没有 = 永久 */
export interface BodyTraitEntry { id: BodyTraitId; source: Exclude<BodyTraitSource, 'innate'>; expiresDay?: number }

export interface BodyTraitDef {
  id: BodyTraitId
  name: string
  desc: string
  /** 改造药剂：名字、价格、药效天数 */
  potion: { name: string; price: number; days: number }
  /** 客人偏好里的说法 */
  prefLabel: string
  /** 写作素材（按步骤：0 迎客 1 挑逗 2 前戏 3 正戏 4 清洗）；play-prompts 风格：写具体身体细节 */
  craft: string[]
}

export const BODY_TRAITS: BodyTraitDef[] = [
  { id: 'lactation', name: '泌乳', desc: '乳房会分泌奶水，一被揉、一动情就往外渗。', potion: { name: '催乳药', price: 160, days: 3 }, prefLabel: '想喝奶 / 母乳',
    craft: ['胸前布料被奶水洇出两小片湿痕，靠近时有温热的奶香', '一揉就渗：乳尖挂着奶珠，顺着乳肉往下淌', '挤出来的奶水溅在他身上、被他含住吮，喉结滚动的咕嘟声', '奶水随抽送一股股喷出，乳沟里积起一洼温热的白', '用温毛巾擦掉奶渍，乳尖还在一滴滴往外渗'] },
  { id: 'sensitive', name: '敏感体质', desc: '全身都比别人敏感，轻轻一碰就发抖。', potion: { name: '敏感药', price: 140, days: 3 }, prefLabel: '敏感 / 一碰就软',
    craft: ['被握住手腕都会轻轻一颤，耳尖瞬间红透', '指尖划过腰侧就让她弓起背、咬住下唇憋声', '每一下爱抚都让她腿根发抖，湿得比平时快得多', '才几下就绞紧发颤，声音完全压不住', '余韵很长，碰到哪里都还会一抽一抽地发抖'] },
  { id: 'estrus', name: '发情期', desc: '正值发情：体温偏高、气味甜腻、主动求欢。', potion: { name: '发情药', price: 150, days: 2 }, prefLabel: '发情 / 主动求欢',
    craft: ['体温偏高、脸颊潮红，身上散着发情的甜腻气味', '忍不住往他身上蹭，腿并得很紧却不停摩擦', '腿根早就湿透，主动抓着他的手往下按', '主动迎合、腰停不下来，一次不够还要', '发情还没退，抱着他不肯松手'] },
  { id: 'aphro', name: '媚药体质', desc: '唾液和体液带着媚药，沾上的人会燥热发情。', potion: { name: '媚毒药', price: 180, days: 2 }, prefLabel: '媚药 / 催情',
    craft: ['吐息带着甜得发腻的香，靠近的人喉咙发干', '一个吻渡过去的唾液让他浑身燥热、心跳加快', '舔过的地方发烫发麻，他的反应明显变得急躁', '体液里的媚药让两人都停不下来，越做越热', '燥热慢慢退去，皮肤上还留着一层潮红'] },
  { id: 'futa', name: '扶她', desc: '长着一根属于自己的肉棒，也会勃起、也会射。', potion: { name: '扶她药', price: 220, days: 1 }, prefLabel: '扶她',
    craft: ['裙下有一处不自然的隆起，她红着脸拿手遮', '隆起越来越明显，前端把布料顶出一点湿痕', '两人的硬挺贴在一起磨蹭，她自己也在套弄', '她的肉棒随着动作晃动、一跳一跳地吐出前液（高潮档才写射）', '收拾时她夹着腿，还没完全软下去'] },
  { id: 'bigbust', name: '乳量增大', desc: '胸部被药力撑大了一圈，沉得坠手。', potion: { name: '丰乳秘药', price: 200, days: 3 }, prefLabel: '爆乳',
    craft: ['衣襟被撑得紧绷、扣子随时要崩开，走一步晃一下', '沉甸甸地压在他手臂上，乳肉从指缝间溢出', '一只手根本握不住，捧起来都坠手', '夹住时整根被乳肉吞没，拍打出沉闷的肉浪声', '衣服重新扣不上，只好用手托着'] },
  { id: 'crest', name: '淫纹', desc: '小腹刻着淫纹，动情时发光、发烫，越亮越敏感。', potion: { name: '淫纹墨', price: 190, days: 3 }, prefLabel: '淫纹',
    craft: ['小腹的淫纹在衣下透出一点淡粉的光', '被注视、被碰到时淫纹一亮一亮地发烫', '淫纹随着快感越来越亮，纹路像在小腹上爬', '每一下顶入淫纹都闪一下，亮到发白（高潮档才写满溢）', '淫纹慢慢暗下去，只剩一圈余温'] },
]
export const getBodyTrait = (id: string | undefined) => BODY_TRAITS.find((t) => t.id === id)
export const BODY_TRAIT_IDS = BODY_TRAITS.map((t) => t.id)

/** 种族天生（永久）。实际在游戏里的种族：牛娘泌乳、魔女淫纹、史莱姆媚药体质 */
export const INNATE_BODY_TRAITS: Record<string, BodyTraitId[]> = { 牛娘: ['lactation'], 魔女: ['crest'], 史莱姆: ['aphro'] }

export interface ActiveBodyTrait { id: BodyTraitId; source: BodyTraitSource; daysLeft?: number }
/** 她此刻的体质（天生 + 后天未到期）；day 缺省时不判到期（到期由结束今天清理） */
export function bodyTraitsOf(g: Pick<MonstGirl, 'race' | 'bodyTraits'>, day?: number): ActiveBodyTrait[] {
  const out: ActiveBodyTrait[] = (INNATE_BODY_TRAITS[g.race] ?? []).map((id) => ({ id, source: 'innate' }))
  for (const e of g.bodyTraits ?? []) {
    if (day !== undefined && e.expiresDay !== undefined && e.expiresDay <= day) continue
    if (out.some((x) => x.id === e.id)) continue
    out.push({ id: e.id, source: e.source, ...(e.expiresDay !== undefined && day !== undefined ? { daysLeft: e.expiresDay - day } : {}) })
  }
  return out
}
export const hasBodyTrait = (g: Pick<MonstGirl, 'race' | 'bodyTraits'>, id: BodyTraitId, day?: number) => bodyTraitsOf(g, day).some((t) => t.id === id)

/** 显示：「泌乳（天生）」「敏感体质（药效余 2 天）」「发情期（觉醒）」 */
export function bodyTraitLabel(t: ActiveBodyTrait): string {
  const name = getBodyTrait(t.id)?.name ?? t.id
  if (t.source === 'innate') return `${name}（天生）`
  if (t.source === 'awaken') return `${name}（觉醒）`
  if (t.daysLeft !== undefined) return `${name}（药效余 ${t.daysLeft} 天）`
  return name
}

/** 加一项后天体质：药剂按天数（同一项再喝取更晚的到期日），觉醒 / 作弊为永久 */
export function grantBodyTrait(g: MonstGirl, id: BodyTraitId, source: BodyTraitEntry['source'], day: number, days?: number): MonstGirl {
  const list = g.bodyTraits ?? []
  const cur = list.find((e) => e.id === id)
  const expiresDay = source === 'potion' ? day + (days ?? getBodyTrait(id)!.potion.days) : days ? day + days : undefined
  if (cur && cur.expiresDay === undefined) return g // 已是永久
  const entry: BodyTraitEntry = { id, source, ...(expiresDay !== undefined ? { expiresDay: Math.max(expiresDay, cur?.expiresDay ?? 0) } : {}) }
  return { ...g, bodyTraits: [...list.filter((e) => e.id !== id), entry] }
}
/** 解药：解除全部药剂带来的体质（天生、觉醒不受影响）；返回解除了几项 */
export function cureBodyTraits(g: MonstGirl): { girl: MonstGirl; removed: BodyTraitId[] } {
  const removed = (g.bodyTraits ?? []).filter((e) => e.source === 'potion').map((e) => e.id)
  return { girl: { ...g, bodyTraits: (g.bodyTraits ?? []).filter((e) => e.source !== 'potion') }, removed }
}
export function removeBodyTrait(g: MonstGirl, id: BodyTraitId): MonstGirl {
  return { ...g, bodyTraits: (g.bodyTraits ?? []).filter((e) => e.id !== id) }
}
/** 新的一天：清掉到期的；返回到期的名字（写进小结） */
export function expireBodyTraits(g: MonstGirl, day: number): { girl: MonstGirl; expired: BodyTraitId[] } {
  const list = g.bodyTraits ?? []
  const expired = list.filter((e) => e.expiresDay !== undefined && e.expiresDay <= day).map((e) => e.id)
  return expired.length ? { girl: { ...g, bodyTraits: list.filter((e) => !expired.includes(e.id)) }, expired } : { girl: g, expired }
}

// ─── 长期调教觉醒（永久） ─────────────────────────────────────────────────────
export const SENSITIVE_AWAKEN = { zones: 4, value: 75 }
export const ESTRUS_AWAKEN_LEWD = 90
/** 夜里检查：四条以上共通敏感带 ≥75 → 敏感体质；淫乱 ≥90 → 发情期 */
export function awakenBodyTraits(g: MonstGirl, day: number): { girl: MonstGirl; awakened: BodyTraitId[] } {
  const awakened: BodyTraitId[] = []
  let out = g
  const zones = ['耳朵', '阴蒂', '唇舌', '乳房', '小穴', '后庭'] as const
  const permanent = (id: BodyTraitId) => bodyTraitsOf(out).some((t) => t.id === id && (t.source === 'innate' || t.source === 'awaken'))
  if (!permanent('sensitive') && zones.filter((z) => (g.sensitivities?.[z] ?? 0) >= SENSITIVE_AWAKEN.value).length >= SENSITIVE_AWAKEN.zones) {
    out = { ...out, bodyTraits: [...(out.bodyTraits ?? []).filter((e) => e.id !== 'sensitive'), { id: 'sensitive', source: 'awaken' }] }; awakened.push('sensitive')
  }
  if (!permanent('estrus') && g.lewdness >= ESTRUS_AWAKEN_LEWD) {
    out = { ...out, bodyTraits: [...(out.bodyTraits ?? []).filter((e) => e.id !== 'estrus'), { id: 'estrus', source: 'awaken' }] }; awakened.push('estrus')
  }
  void day
  return { girl: out, awakened }
}

// ─── 客人偏好 / 结算 ──────────────────────────────────────────────────────────
export const BODY_GREET_BONUS = 4
/** 客人偏好的体质：约两成客人有 */
export const BODY_PREF_CHANCE = 0.2
export function rollPrefBody(rng: () => number): BodyTraitId | undefined {
  return rng() < BODY_PREF_CHANCE ? BODY_TRAIT_IDS[Math.floor(rng() * BODY_TRAIT_IDS.length)] : undefined
}
export function bodyPrefHit(guest: Pick<Guest, 'prefBody'>, g: Pick<MonstGirl, 'race' | 'bodyTraits'>): boolean {
  return !!guest.prefBody && hasBodyTrait(g, guest.prefBody)
}
/** 定向换客人的关键词 */
export const BODY_BIAS_WORDS: Record<BodyTraitId, RegExp> = {
  lactation: /泌乳|母乳|奶水|喝奶|哺乳/, sensitive: /敏感体质/, estrus: /发情/, aphro: /媚药|催情/, futa: /扶她|双性/, bigbust: /乳量增大|乳量/, crest: /淫纹/,
}

// ─── 体质 play（有这项体质才能选；固定计分档，对口条件同种族 play） ─────────
const tp = (trait: BodyTraitId, id: string, name: string, zone: PlayDef['zone'], match: NonNullable<PlayDef['match']>): PlayDef =>
  ({ id: `trait_${id}`, name, source: 'trait', bodyTrait: trait, rank: '熟练', zone, match })
export const TRAIT_PLAYS: PlayDef[] = [
  tp('lactation', 'nursing', '哺乳', '乳房', { services: ['胸侍'], keywords: ['乳交', '温柔'] }),
  tp('lactation', 'milk_service', '奶水侍奉', '乳房', { services: ['胸侍', '口侍'], kinds: ['中性'] }),
  tp('futa', 'futa_reverse', '扶她反攻', undefined, { kinds: ['S'], keywords: ['榨'] }),
  tp('crest', 'crest_glow', '淫纹催淫', '小穴', { kinds: ['中性', 'S'], keywords: ['痴女'] }),
  tp('aphro', 'aphro_kiss', '媚药之吻', '唇舌', { services: ['口侍'], kinds: ['M'] }),
  tp('estrus', 'estrus_beg', '发情求欢', '小穴', { services: ['身侍'], keywords: ['主动', '求欢'] }),
]
/** 这项体质 play 她能不能选（魔女已有种族 play「淫纹魔法」，不重复给淫纹 play） */
export function traitPlayAvailable(p: PlayDef, g: Pick<MonstGirl, 'race' | 'bodyTraits'>): boolean {
  if (!p.bodyTrait || !hasBodyTrait(g, p.bodyTrait as BodyTraitId)) return false
  if (p.id === 'trait_crest_glow' && g.race === '魔女') return false
  return true
}

// ─── 提示词 ───────────────────────────────────────────────────────────────────
/** 角色卡上的「体质」一行（没有时空串） */
export function bodyTraitLine(g: Pick<MonstGirl, 'race' | 'bodyTraits'>, day?: number): string {
  const ts = bodyTraitsOf(g, day)
  return ts.length ? `体质：${ts.map((t) => `${bodyTraitLabel(t)}——${getBodyTrait(t.id)!.desc}`).join('；')}` : ''
}
/** 【体质的写法】：这一步每项体质该落在哪个身体细节上（化用、不要照抄） */
export function bodyTraitCraft(g: Pick<MonstGirl, 'name' | 'race' | 'bodyTraits'>, stepIndex: number, day?: number): string {
  const ts = bodyTraitsOf(g, day)
  if (!ts.length) return ''
  const i = Math.max(0, Math.min(4, stepIndex))
  return `【${g.name}的体质写法（这一步；化用，不要照抄）】\n${ts.map((t) => `- ${getBodyTrait(t.id)!.name}：${getBodyTrait(t.id)!.craft[i]}`).join('\n')}`
}
