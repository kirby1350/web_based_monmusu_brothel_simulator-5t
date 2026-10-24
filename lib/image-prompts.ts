// ============================================================================
// 生图相关共享常量（PixAI 与 TensorArt 两条路由共用，保证出图质量一致）
// ============================================================================

/** 所有图片提示词统一前置的质量标签 */
export const IMAGE_QUALITY_PREFIX = 'masterpiece, best quality, amazing quality, adult'

/** 统一的负面提示词（PixAI 与 TensorArt 共用） */
export const IMAGE_NEGATIVE_PROMPT =
  'lowres, worst quality, low quality, normal quality, jpeg artifacts, blurry, bad anatomy, bad hands, extra fingers, missing fingers, extra digit, fewer digits, extra arms, extra legs, fused bodies, cropped, text, signature, watermark, username, artist name, patreon username, patreon logo, speech bubble, logo, multiple girls, child, loli, shota, petite, flat chest, small breasts, aged down'

/** 按角色标签追加的额外负面词（只对含该角色名标签的提示词生效） */
export const CHARACTER_NEGATIVE_EXTRA: Record<string, string> = {
  'taihou_(azur_lane)': 'mask, mask on head, golden mask',
}

/** 负面词 = 统一负面词 + 可选的额外负面词 + 提示词里角色对应的额外负面词 */
export function negativePromptFor(prompts: unknown, negativeExtra?: unknown): string {
  const text = typeof prompts === 'string' ? prompts : ''
  const extras = Object.entries(CHARACTER_NEGATIVE_EXTRA)
    .filter(([tag]) => text.includes(tag))
    .map(([, neg]) => neg)
  if (typeof negativeExtra === 'string' && negativeExtra.trim()) extras.unshift(negativeExtra.trim())
  return [IMAGE_NEGATIVE_PROMPT, ...extras].join(', ')
}

/** 给纯标签补齐质量前缀（已含 masterpiece 则原样返回） */
export function withQualityPrefix(tags: string): string {
  const t = tags.trim()
  if (/masterpiece/i.test(t)) return t
  return `${IMAGE_QUALITY_PREFIX}, ${t}`
}
