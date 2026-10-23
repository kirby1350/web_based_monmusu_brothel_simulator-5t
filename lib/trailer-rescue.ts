// 回复漏了末尾 STATS/ACTIONS 数据块时的补救：
// 1) 检出缺失/解析不了的块；2) 用原 /api/chat 请求格式再问一次，只要这两行；
// 3) 把补到的块并进原回复；还缺的就填默认（不改数值、默认推荐行动），界面不受影响。
import { parseStatsFromReply, parseActionsFromReply, stripStatsBlock } from './game-engine'

export const DEFAULT_ACTIONS: [string, string, string] = ['继续当前行动', '加深刺激力度', '改变姿势角度']

export interface TrailerCheck { stats: boolean; actions: boolean }

/** 哪些块可用（能被现有解析器读出来） */
export function checkTrailer(raw: string): TrailerCheck {
  return { stats: parseStatsFromReply(raw) !== null, actions: parseActionsFromReply(raw) !== null }
}

export function needsTrailerRescue(raw: string): boolean {
  if (!raw.trim()) return false
  const c = checkTrailer(raw)
  return !c.stats || !c.actions
}

/** 补救请求：只给正文，只要两行 */
export function buildTrailerRescueMessages(raw: string, names: string[]): { role: 'user'; content: string }[] {
  const girls = names.map((n) => `"${n}":{"pleasure":N,"stamina":N}`).join(',')
  return [{ role: 'user', content:
`下面是一段已经写好的回合正文。不要续写、不要复述正文，只按正文内容输出下面两行，别的什么都不要写：
<!--STATS:{"girls":{${girls}},"satisfaction":N}-->
<!--ACTIONS:["行动一","行动二","行动三"]-->
其中 pleasure 是她这回合快感变化（-10~20），stamina 是体力消耗（-20~-2），satisfaction 是客人满意度变化（-5~20）；ACTIONS 是接下来三条简短的推荐行动（每条 4–12 字）。

【正文】
${stripStatsBlock(raw)}` }]
}

/** 默认块：快感/满意度 0；体力取解析器允许的最小消耗 -2 */
export function defaultStatsLine(names: string[]): string {
  return `<!--STATS:${JSON.stringify({ girls: Object.fromEntries(names.map((n) => [n, { pleasure: 0, stamina: -2 }])), satisfaction: 0 })}-->`
}
export function defaultActionsLine(): string {
  return `<!--ACTIONS:${JSON.stringify(DEFAULT_ACTIONS)}-->`
}

const STATS_BLOCK = /<!--\s*STATS\s*[:：][\s\S]*?-->/
const ACTIONS_BLOCK = /<!--\s*ACTIONS\s*[:：][\s\S]*?-->/

export type RescueSource = 'none' | 'rescued' | 'partial' | 'default'

/** 把补救回复里的块并进原回复：原回复里坏掉的块去掉，补上能解析的；仍缺的填默认 */
export function mergeTrailer(raw: string, rescueText: string | null, names: string[]): { text: string; source: RescueSource } {
  const have = checkTrailer(raw)
  if (have.stats && have.actions) return { text: raw, source: 'none' }
  let body = raw
  if (!have.stats) body = body.replace(STATS_BLOCK, '')
  if (!have.actions) body = body.replace(ACTIONS_BLOCK, '')
  body = body.trimEnd()
  const got = rescueText ? checkTrailer(rescueText) : { stats: false, actions: false }
  const lines: string[] = []
  let fromRescue = 0, fromDefault = 0
  if (!have.stats) {
    if (got.stats) { lines.push(rescueText!.match(STATS_BLOCK)![0]); fromRescue++ } else { lines.push(defaultStatsLine(names)); fromDefault++ }
  }
  if (!have.actions) {
    if (got.actions) { lines.push(rescueText!.match(ACTIONS_BLOCK)![0]); fromRescue++ } else { lines.push(defaultActionsLine()); fromDefault++ }
  }
  const source: RescueSource = fromDefault === 0 ? 'rescued' : fromRescue === 0 ? 'default' : 'partial'
  return { text: `${body}\n\n${lines.join('\n')}`, source }
}

/** 整个流程；ask 抛错或返回空都按失败处理，最终一定返回可解析的回复 */
export async function rescueTrailer(raw: string, names: string[], ask: (messages: { role: 'user'; content: string }[]) => Promise<string>): Promise<{ text: string; source: RescueSource }> {
  if (!needsTrailerRescue(raw)) return { text: raw, source: 'none' }
  let reply: string | null = null
  try { reply = await ask(buildTrailerRescueMessages(raw, names)) } catch { reply = null }
  return mergeTrailer(raw, reply, names)
}
