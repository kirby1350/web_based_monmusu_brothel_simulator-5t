// 立绘多尺寸：sm（160w，缩略/列表）、md（480w，卡片/详情）、full（原图，全屏/放大）。
// 只有 PORTRAIT_VARIANT_SOURCES 里的本地立绘有变体；AI 生成或远程 URL 一律原样返回。
import { PORTRAIT_VARIANT_SOURCES } from './portrait-manifest'

export type PortraitSize = 'sm' | 'md' | 'full'
export const PORTRAIT_WIDTHS = { sm: 160, md: 480 } as const

const SOURCES = new Set(PORTRAIT_VARIANT_SOURCES)

function variantUrl(url: string, size: 'sm' | 'md'): string {
  const i = url.lastIndexOf('/')
  const dir = url.slice(0, i)
  const stem = url.slice(i + 1).replace(/\.[^.]+$/, '')
  return `${dir}/sizes/${stem}-${size}.webp`
}

export function hasPortraitVariants(url: string | null | undefined): boolean {
  return !!url && SOURCES.has(url)
}

/** 取某尺寸的立绘 URL；没有变体（AI 图、远程图、未登记的图）或要原图时返回原 URL */
export function portraitSrc(url: string, size: PortraitSize): string
export function portraitSrc(url: string | null | undefined, size: PortraitSize): string | undefined
export function portraitSrc(url: string | null | undefined, size: PortraitSize): string | undefined {
  if (!url) return url ?? undefined
  if (size === 'full' || !hasPortraitVariants(url)) return url
  return variantUrl(url, size)
}

/** 有变体时给出 srcSet（sm/md/原图），让高分屏在需要时仍能取到更清晰的版本；否则 undefined */
export function portraitSrcSet(url: string | null | undefined, fullWidth = 1152): string | undefined {
  if (!url || !hasPortraitVariants(url)) return undefined
  return `${variantUrl(url, 'sm')} ${PORTRAIT_WIDTHS.sm}w, ${variantUrl(url, 'md')} ${PORTRAIT_WIDTHS.md}w, ${url} ${fullWidth}w`
}

/** 各尺寸默认的 sizes 提示（CSS 显示宽度） */
export const PORTRAIT_SIZES_HINT: Record<PortraitSize, string | undefined> = {
  sm: '64px',
  md: '240px',
  full: undefined,
}
/** 响应式大卡片（市场/模板/魔物娘卡）：手机单列铺满，桌面约 320px */
export const PORTRAIT_CARD_SIZES = '(max-width: 640px) 100vw, 320px'
