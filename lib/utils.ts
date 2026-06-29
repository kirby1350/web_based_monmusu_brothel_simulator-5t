import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 宽容解析 AI 输出的 JSON。
 *
 * 先严格 JSON.parse；失败时再把模型常见的「全角结构符号」（，：［］｛｝、全角数字、全角空格）
 * 归一化为半角后重试。归一化只在严格解析已失败时触发，因此不会破坏本就合法的内容。
 * 全部失败返回 null（调用方据此走兜底）。
 */
export function parseLooseJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    // fall through to lenient normalization
  }
  const normalized = text
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/［/g, '[')
    .replace(/］/g, ']')
    .replace(/｛/g, '{')
    .replace(/｝/g, '}')
    .replace(/　/g, ' ')
    // 全角数字 ０-９ → 半角（用于 STATS / 市场数值）
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
  try {
    return JSON.parse(normalized) as T
  } catch {
    return null
  }
}
