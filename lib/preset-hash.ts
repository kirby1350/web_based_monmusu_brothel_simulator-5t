/** 32 位 FNV-1a（按 UTF-16 码元），用于比对预设文本是否被玩家改过 */
export function presetTextHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
