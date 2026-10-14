'use client'

// 道具小图标：金色细框；图片缺失或加载失败时显示名字首字
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function ItemIcon({ src, name, size = 28, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  const box = 'shrink-0 rounded-md border border-amber-400/40 bg-black/40 overflow-hidden shadow-[0_0_6px_oklch(0.78_0.18_85/0.25)]'
  if (!src || failed) {
    return (
      <span data-testid="item-icon-fallback" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
        className={cn(box, 'inline-flex items-center justify-center gold-text font-semibold', className)}>
        {name.slice(0, 1)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size} loading="lazy" onError={() => setFailed(true)}
      data-testid="item-icon" className={cn(box, 'object-cover', className)} style={{ width: size, height: size }} />
  )
}
