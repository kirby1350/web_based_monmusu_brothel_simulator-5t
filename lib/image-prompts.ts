// ============================================================================
// 生图相关共享常量（PixAI 与 TensorArt 两条路由共用，保证出图质量一致）
// ============================================================================

/** 所有图片提示词统一前置的质量标签 */
export const IMAGE_QUALITY_PREFIX = 'masterpiece, best quality, highly detailed'

/** 统一的负面提示词（PixAI 与 TensorArt 共用） */
export const IMAGE_NEGATIVE_PROMPT =
  'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'

/** 给纯标签补齐质量前缀（已含 masterpiece 则原样返回） */
export function withQualityPrefix(tags: string): string {
  const t = tags.trim()
  if (/masterpiece/i.test(t)) return t
  return `${IMAGE_QUALITY_PREFIX}, ${t}`
}
