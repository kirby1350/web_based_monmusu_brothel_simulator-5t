import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 把 JSON 文本里「字符串字面量之外」的结构性全角符号归一为 ASCII：
 *   ：→: ，→, ｛→{ ｝→} ［→[ ］→] 全角空格→空格，全角数字→半角。
 * **字符串内部原样保留**（中文逗号/冒号等标点不动，避免破坏描述文案）。
 */
export function normalizeJsonStructure(input: string): string {
  let out = ''
  let inStr = false
  let escaped = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inStr) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; out += ch; continue }
    switch (ch) {
      case '：': out += ':'; break
      case '，': out += ','; break
      case '｛': out += '{'; break
      case '｝': out += '}'; break
      case '［': out += '['; break
      case '］': out += ']'; break
      case '　': out += ' '; break
      default:
        // 仅字符串外部的全角数字转半角（结构性数值，无歧义）
        if (ch >= '０' && ch <= '９') out += String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
        else out += ch
    }
  }
  return out
}

/**
 * 修复被 max_tokens 截断的 JSON：闭合未结束的字符串、丢弃尾部悬空的逗号/冒号/无值 key、
 * 补齐未闭合的 {} []。尽力而为，失败由调用方兜底。
 */
export function repairTruncatedJson(input: string): string {
  let s = input.trim()
  let inStr = false
  let escaped = false
  const stack: string[] = []
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }
  if (inStr) s += '"'                                   // 收尾在字符串中 → 闭合
  s = s.replace(/[,:]\s*$/, '')                         // 尾部悬空逗号/冒号
  s = s.replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, '')        // 尾部悬空的无值 "key"
  s = s.replace(/[,:]\s*$/, '')
  while (stack.length) s += stack.pop()                 // 补齐未闭合括号
  return s
}

/**
 * 宽容解析 AI 输出的 JSON。三级兜底：
 *   1) 严格 JSON.parse
 *   2) 字符串感知的全角结构归一后重试
 *   3) 截断修复后重试
 * 全部失败返回 null（调用方据此走兜底）。
 */
export function parseLooseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch { /* 1) 严格失败 */ }

  const normalized = normalizeJsonStructure(text)
  try {
    return JSON.parse(normalized) as T
  } catch { /* 2) 归一后仍失败 */ }

  try {
    return JSON.parse(repairTruncatedJson(normalized)) as T
  } catch {
    return null
  }
}
