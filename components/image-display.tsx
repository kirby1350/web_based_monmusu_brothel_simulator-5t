'use client'

import { useState, useEffect, useCallback } from 'react'
import { ImageIcon, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateImage, friendlyImageError, imageAuthFailed, markImageAuthFailed } from '@/lib/image-service'
import { AppSettings } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PortraitImg } from '@/components/portrait-img'
import type { PortraitSize } from '@/lib/portrait'

interface ImageDisplayProps {
  tags: string
  settings: AppSettings
  cachedUrl?: string
  onUrlCached?: (url: string) => void
  alt?: string
  className?: string
  autoGenerate?: boolean
  /** 立绘尺寸：sm 缩略/列表，md 卡片/详情（默认），full 原图 */
  size?: PortraitSize
  /** 覆盖 sizes 提示 */
  sizes?: string
}

export function ImageDisplay({
  tags,
  settings,
  cachedUrl,
  onUrlCached,
  alt = '角色图片',
  className,
  autoGenerate = false,
  size = 'md',
  sizes,
}: ImageDisplayProps) {
  const [url, setUrl] = useState<string>(cachedUrl ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Allow generation attempt if the user has explicitly provided a key in settings,
  // OR always allow so the server-side env var (PIXAI_API_KEY / TENSORART_API_KEY) can be used.
  // Real auth failures will surface as error messages after the API call.
  const hasApiKey = !!settings.pixaiApiKey || !!settings.tensorartApiKey || settings.imageProvider === 'pixai' || settings.imageProvider === 'tensorart'

  const generate = useCallback(async () => {
    if (!tags) return
    setLoading(true)
    setError('')
    const result = await generateImage(tags, settings)
    setLoading(false)
    if (result.url) {
      setUrl(result.url)
      onUrlCached?.(result.url)
    } else {
      const err = friendlyImageError(result.error)
      if (err.auth) markImageAuthFailed(settings.imageProvider)
      setError(err.text)
    }
  }, [tags, settings, onUrlCached])

  useEffect(() => {
    if (cachedUrl) setUrl(cachedUrl)
  }, [cachedUrl])

  useEffect(() => {
    // 自动生图：已有图片不生成；本次会话里该服务商已因缺 Key/鉴权失败过，也不再自动打（手动点仍可重试）
    if (autoGenerate && !url && hasApiKey && tags && !imageAuthFailed(settings.imageProvider)) {
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  if (!hasApiKey) {
    // Even without an API key, show the cached/preset image if available
    if (url) {
      return (
        <div className={cn('relative rounded-lg overflow-hidden', className)}>
          <PortraitImg url={url} size={size} sizes={sizes} alt={alt} className="w-full h-full object-cover object-top" />
        </div>
      )
    }
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/20 aspect-[3/4]',
          className
        )}
      >
        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-[10px] text-muted-foreground/40 text-center px-4">
          在设置中配置 API Key 后启用生图
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/20 aspect-[3/4]',
          className
        )}
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">生成中…</p>
      </div>
    )
  }

  if (url) {
    return (
      <div className={cn('relative group rounded-lg overflow-hidden', className)}>
        <PortraitImg url={url} size={size} sizes={sizes} alt={alt} className="w-full h-full object-cover object-top" />
        {/* 缩略图（sm）整块是点击目标，不放重绘按钮；其余放在右上角的小按钮，不挡脸 */}
        {size !== 'sm' && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/60 text-white hover:bg-black/80 transition-opacity opacity-70 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={(e) => { e.stopPropagation(); generate() }}
            title="重新生图"
            aria-label="重新生图"
            data-testid="image-regenerate"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
        {error && <p className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-rose-300/90 px-1.5 py-0.5 truncate">{error}</p>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border border-dashed bg-muted/10 aspect-[3/4] cursor-pointer hover:bg-muted/20 transition-colors',
        className
      )}
      // 缩略图（sm）的占位块交给外层（打开详情），不在这里生图
      onClick={size === 'sm' ? undefined : (e) => { e.stopPropagation(); generate() }}
    >
      {error ? (
        <>
          <ImageIcon className="w-8 h-8 text-destructive/50" />
          <p className="text-[10px] text-destructive/70 text-center px-3">{error}</p>
          <Button size="sm" variant="outline" className="text-xs h-7 px-3" onClick={(e) => { e.stopPropagation(); generate() }}>
            重试
          </Button>
        </>
      ) : (
        <>
          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/50">点击生成图片</p>
        </>
      )}
    </div>
  )
}
