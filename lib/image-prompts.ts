// ============================================================================
// 生图相关共享常量（PixAI 与 TensorArt 两条路由共用，保证出图质量一致）
// ============================================================================

/** 所有图片提示词统一前置的质量标签 */
export const IMAGE_QUALITY_PREFIX = 'masterpiece, best quality, amazing quality, adult'

/** 统一的负面提示词（PixAI 与 TensorArt 共用） */
export const IMAGE_NEGATIVE_PROMPT =
  'lowres, worst quality, low quality, normal quality, jpeg artifacts, blurry, bad anatomy, bad hands, extra fingers, missing fingers, extra digit, fewer digits, extra arms, extra legs, fused bodies, cropped, text, signature, watermark, username, artist name, patreon username, patreon logo, speech bubble, logo, multiple girls, child, loli, shota, petite, flat chest, small breasts, aged down'

/** 给纯标签补齐质量前缀（已含 masterpiece 则原样返回） */
export function withQualityPrefix(tags: string): string {
  const t = tags.trim()
  if (/masterpiece/i.test(t)) return t
  return `${IMAGE_QUALITY_PREFIX}, ${t}`
}
