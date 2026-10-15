// 口癖（speechStyle）：自称 / 称呼 / 语气与句尾 / 招牌台词。预设角色必有，AI 生成与自建角色可为空。
import type { MonstGirl } from './types'

/** 进 prompt 时的使用规则（只在有人带口癖时附上一次） */
export const SPEECH_RULE = '口癖使用规则：台词要自然地带出各自的口癖与语气；自称和对馆主/客人的称呼必须始终一致、不可混用；句尾口癖与招牌台词点到为止，不要每句都刷，也不要原样照抄招牌台词'

/** 单行口癖摘要（多行折成一行），没有时返回空串 */
export function speechBrief(g: Pick<MonstGirl, 'speechStyle'>): string {
  const s = g.speechStyle?.trim()
  return s ? s.split('\n').map((l) => l.trim()).filter(Boolean).join('；') : ''
}

/** 形如「口癖：…」的一段（带前缀），没有时空串；sep 用于拼接到已有行后 */
export function speechLine(g: Pick<MonstGirl, 'speechStyle'>, sep = '\n', label = '口癖'): string {
  const b = speechBrief(g)
  return b ? `${sep}${label}：${b}` : ''
}

/** 一组角色里有人带口癖时返回规则行（带前导换行），否则空串 */
export function speechRuleFor(girls: Pick<MonstGirl, 'speechStyle'>[], sep = '\n'): string {
  return girls.some((g) => speechBrief(g)) ? `${sep}${SPEECH_RULE}` : ''
}

/** 把多行口癖拆成 [标签, 内容] 方便 UI 显示；不符合「标签：内容」的行标签为空 */
export function speechRows(s: string | undefined): [string, string][] {
  return (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^([^：:]{1,6})[：:](.*)$/)
    return m ? [m[1], m[2].trim()] : ['', l]
  })
}
