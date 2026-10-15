'use client'

import { useState, useEffect } from 'react'
import { portraitSrc, portraitSrcSet, PORTRAIT_SIZES_HINT, type PortraitSize } from '@/lib/portrait'

interface PortraitImgProps {
  url: string
  size?: PortraitSize
  /** 覆盖 sizes 提示（CSS 显示宽度） */
  sizes?: string
  alt?: string
  className?: string
}

/** 立绘 <img>：本地立绘用 sm/md webp 变体 + srcSet；变体加载失败或没有变体时退回原图 */
export function PortraitImg({ url, size = 'md', sizes, alt = '', className }: PortraitImgProps) {
  const [fallback, setFallback] = useState(false)
  useEffect(() => { setFallback(false) }, [url])
  const useVariant = !fallback && size !== 'full'
  const src = useVariant ? portraitSrc(url, size) : url
  const srcSet = useVariant ? portraitSrcSet(url) : undefined
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} srcSet={srcSet} sizes={srcSet ? (sizes ?? PORTRAIT_SIZES_HINT[size]) : undefined}
      alt={alt} className={className} decoding="async" loading={size === 'sm' ? 'lazy' : undefined}
      onError={() => { if (useVariant && src !== url) setFallback(true) }} />
  )
}
