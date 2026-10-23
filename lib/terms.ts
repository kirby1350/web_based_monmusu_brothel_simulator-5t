// 称呼系统：自称 / 对玩家的称呼 / 器官叫法。
// 默认按档位走：器官跟本回合快感档（临时），自称和称呼跟长期堕落档（永久）。
// 外部覆盖优先级：作弊 > 锁定 > 玩家命令 / 调教 > 淫纹类道具（限时，提升一档）> 默认。

export type TermSlot = 'self' | 'player' | 'breast' | 'pussy' | 'anus'
export const TERM_SLOTS: TermSlot[] = ['self', 'player', 'breast', 'pussy', 'anus']
export const TERM_SLOT_LABEL: Record<TermSlot, string> = { self: '自称', player: '叫你', breast: '胸', pussy: '下面', anus: '后面' }
export const CORRUPT_TIERS = ['矜持', '动摇', '沦陷', '崩坏'] as const
export const AROUSAL_TIERS = ['从容', '动摇', '慌乱', '临界', '高潮'] as const

/** 四档：矜持 / 动摇 / 沦陷 / 崩坏 */
export type Ladder = [string, string, string, string]
export interface TermProfile { self: Ladder; player: Ladder; breast: Ladder; pussy: Ladder; anus: Ladder; maternal?: boolean }

export type TermSource = 'default' | 'item' | 'command' | 'training' | 'lock' | 'cheat'
export const TERM_SOURCE_LABEL: Record<TermSource, string> = { default: '默认', item: '淫纹', command: '你的命令', training: '调教', lock: '已锁定', cheat: '作弊' }

export interface TermOverride { slot: TermSlot; value: string; source: 'command' | 'training' | 'cheat'; at?: number }
export interface TermsState {
  overrides?: TermOverride[]
  /** 锁定：把某一格钉在这个值上，不再随档位变 */
  locked?: Partial<Record<TermSlot, string>>
  /** 长期堕落的额外积累（游戏自己决定怎么涨） */
  corruptionBonus?: number
  /** 淫纹类道具：在这个时刻（回合 / 天）之前生效，档位 +1 */
  itemUntil?: number
  itemLabel?: string
}

export interface ResolvedTerm { value: string; source: TermSource }
export type ResolvedTerms = Record<TermSlot, ResolvedTerm> & { corruptTier: number; arousalTier: number; boosted: boolean }

export function corruptTierOf(score: number): number {
  return score >= 75 ? 3 : score >= 50 ? 2 : score >= 25 ? 1 : 0
}
/** 快感 → 从容/动摇/慌乱/临界/高潮，与淫叫档一致 */
export function arousalTierOf(pleasure: number): number {
  return pleasure >= 95 ? 4 : pleasure >= 80 ? 3 : pleasure >= 60 ? 2 : pleasure >= 40 ? 1 : 0
}

export function itemActive(state: TermsState | undefined, now: number): boolean {
  return state?.itemUntil !== undefined && state.itemUntil > now
}

export function resolveTerms(profile: TermProfile, state: TermsState | undefined, opts: { corruption: number; pleasure: number; now: number; boost?: boolean }): ResolvedTerms {
  const ct = corruptTierOf(opts.corruption)
  const at = arousalTierOf(opts.pleasure)
  const boosted = !!opts.boost || itemActive(state, opts.now)
  const b = boosted ? 1 : 0
  const organ = (bb: number) => Math.min(3, [0, 1, 2, 3, 3][at] + bb, ct + 1 + bb)
  const out = { corruptTier: ct, arousalTier: at, boosted } as ResolvedTerms
  for (const slot of TERM_SLOTS) {
    const personal = slot === 'self' || slot === 'player'
    const idx = personal ? Math.min(3, ct + b) : organ(b)
    const plain = personal ? ct : organ(0)
    const base = profile[slot][idx]
    const baseSource: TermSource = base !== profile[slot][plain] ? 'item' : 'default'
    const ovs = (state?.overrides ?? []).filter((o) => o.slot === slot)
    const cheat = ovs.filter((o) => o.source === 'cheat').at(-1)
    const cmd = ovs.filter((o) => o.source !== 'cheat').at(-1)
    const lock = state?.locked?.[slot]
    out[slot] = cheat ? { value: cheat.value, source: 'cheat' }
      : lock ? { value: lock, source: 'lock' }
      : cmd ? { value: cmd.value, source: cmd.source }
      : { value: base, source: baseSource }
  }
  return out
}

/** 每回合贴在最新消息旁边的一行 */
export function termsLine(name: string, r: ResolvedTerms): string {
  return `【本回合称呼·${name}】自称「${r.self.value}」｜叫你「${r.player.value}」｜胸叫「${r.breast.value}」｜下面叫「${r.pussy.value}」｜后面叫「${r.anus.value}」（堕落：${CORRUPT_TIERS[r.corruptTier]}，快感：${AROUSAL_TIERS[r.arousalTier]}）。她的台词里只用这几个叫法，不要混回旧叫法；写到的部位才用，没写到不硬塞；${r.corruptTier < 3 && !/母猪|肉便器/.test(r.self.value) ? '她还没堕到底，台词里不准自称母猪、肉便器之类；' : ''}叙述部分照常。`
}

export const TERMS_RULE = '称呼规则：每个角色的自称、对你的称呼、器官叫法以【本回合称呼】那一行为准，会随堕落和快感改变；同一回合内保持一致，不要混用旧叫法；「母猪」「肉便器」「精液便所」这类自贬只有那一行里写了才能说，没写就不准自己升级；口癖、语气、句尾仍按原作。'

const ORGAN_WORDS: [RegExp, TermSlot][] = [
  [/^(胸|胸部|奶|奶子|乳房|乳|咪咪|骚奶|大奶|奶头|乳头)$/, 'breast'],
  [/^(小穴|穴|下面|屄|骚屄|阴道|蜜穴|肉穴|小屄|骚穴|子宫)$/, 'pussy'],
  [/^(屁股|屁穴|后面|菊花|肛门|屁眼|后穴|肛穴)$/, 'anus'],
]
const clean = (s: string) => s.replace(/^[「“"『']+|[」”"』'。，,！!？?…~～\s]+$/g, '').replace(/(吧|了|哦|呢|啊|喔)+$/, '').trim()

/** 从玩家输入里找改称呼的命令。只认带「以后 / 从现在起 / 改口 / 今后」或「把…叫做…」的说法。 */
export function detectTermCommands(input: string): { slot: TermSlot; value: string }[] {
  const out: { slot: TermSlot; value: string }[] = []
  const push = (slot: TermSlot, raw: string) => {
    const value = clean(raw)
    if (value && value.length <= 10 && !out.some((o) => o.slot === slot)) out.push({ slot, value })
  }
  for (const sentence of input.split(/[。！!？?\n；;]/)) {
    const future = /(以后|今后|从现在起|从今天起|从此|往后|改口|永远)/.test(sentence)
    let m = sentence.match(/把(?:你的?|她的?|自己的?)?([\u4e00-\u9fa5]{1,3})(?:叫做|叫作|称为|称作|叫成|改叫|改成|说成)[「“"『]?([^，,。」”"』\s]{1,10})/)
    if (m) { const hit = ORGAN_WORDS.find(([re]) => re.test(m![1])); if (hit) push(hit[1], m[2]) }
    m = sentence.match(/(?:自称|叫自己|称自己|称呼自己|管自己叫)(?:为|做|作|成)?[「“"『]?([^，,。」”"』\s]{1,10})/)
    if (m && (future || /要|必须|只准|给我/.test(sentence))) push('self', m[1])
    m = sentence.match(/(?:叫我|称呼我|喊我|管我叫|称我)(?:为|做|作|成)?[「“"『]?([^，,。」”"』\s]{1,10})/)
    if (m && future) push('player', m[1])
  }
  return out
}

export function addOverrides(state: TermsState | undefined, cmds: { slot: TermSlot; value: string }[], source: TermOverride['source'], at = Date.now()): TermsState {
  const prev = state ?? {}
  if (!cmds.length) return prev
  const keep = (prev.overrides ?? []).filter((o) => !(o.source === source && cmds.some((c) => c.slot === o.slot)) && !(source !== 'cheat' && o.source !== 'cheat' && cmds.some((c) => c.slot === o.slot)))
  return { ...prev, overrides: [...keep, ...cmds.map((c) => ({ ...c, source, at }))] }
}
/** 撤销某格的命令 / 调教 / 作弊覆盖和锁定，回到默认档位 */
export function resetSlot(state: TermsState | undefined, slot: TermSlot): TermsState {
  const prev = state ?? {}
  const locked = { ...(prev.locked ?? {}) }
  delete locked[slot]
  return { ...prev, overrides: (prev.overrides ?? []).filter((o) => o.slot !== slot), locked }
}
export function toggleLock(state: TermsState | undefined, slot: TermSlot, current: string): TermsState {
  const prev = state ?? {}
  const locked = { ...(prev.locked ?? {}) }
  if (locked[slot]) delete locked[slot]; else locked[slot] = current
  return { ...prev, locked }
}

/** 改口提示：只比较自称和称呼 */
export function termsChange(before: ResolvedTerms, after: ResolvedTerms, name: string): string | null {
  const parts: string[] = []
  if (before.self.value !== after.self.value) parts.push(`自称「${before.self.value}」→「${after.self.value}」`)
  if (before.player.value !== after.player.value) parts.push(`叫你「${before.player.value}」→「${after.player.value}」`)
  return parts.length ? `${name}改口了：${parts.join('，')}` : null
}

const L = (s: string): Ladder => { const a = s.split('|'); while (a.length < 4) a.push(a[a.length - 1]); return a.slice(0, 4) as Ladder }
/** 数据写法：'我|我|人家|母猪' 这样四档一行 */
export function profile(self: string, player: string, breast: string, pussy: string, anus: string, maternal = false): TermProfile {
  return { self: L(self), player: L(player), breast: L(breast), pussy: L(pussy), anus: L(anus), maternal }
}

const GENERIC_BREAST = '胸部|奶子|淫乱的奶子|骚奶'
const GENERIC_PUSSY = '那里|小穴|湿透的骚穴|骚屄'
const GENERIC_ANUS = '后面|屁穴|骚屁穴|淫荡的屁穴'

/** 没登记的角色：从口癖里的「自称：」「称呼：」读出基础叫法 */
export function genericProfile(speech: string | undefined, fallbackPlayer: string): TermProfile {
  const selfLine = speech?.match(/自称：([^\n]*)/)?.[1] ?? ''
  const self = selfLine.match(/^[「]?([^，,（(／/；;」\s]{1,5})/)?.[1] ?? '我'
  const callLine = speech?.match(/称呼：([^\n]*)/)?.[1] ?? ''
  const player = callLine.match(/「([^」]{1,8})」/)?.[1] ?? fallbackPlayer
  return profile(`${self}|${self}|${self}|${self}`, `${player}|${player}|${player}|主人`, GENERIC_BREAST, GENERIC_PUSSY, GENERIC_ANUS)
}

/** 粗口上限检查（测试用）：原作角色只在崩坏档出现母猪 / 肉便器；母性角色不出现 */
export function capViolations(p: TermProfile): string[] {
  const bad: string[] = []
  for (const slot of TERM_SLOTS) p[slot].forEach((w, i) => {
    if (/母猪|肉便器/.test(w) && (i < 3 || p.maternal)) bad.push(`${slot}[${i}]=${w}`)
  })
  if (p.maternal && p.breast[3] !== '妈妈的骚奶') bad.push('maternal breast cap')
  return bad
}
