'use client'

// 口癖卡片：自称 / 称呼 / 语气 / 招牌台词（与性格段落同款暗色窄栏）
import { speechRows } from '@/lib/speech-style'

export function SpeechStyleBlock({ value, className = '' }: { value?: string; className?: string }) {
  const rows = speechRows(value)
  if (rows.length === 0) return null
  return (
    <div data-testid="speech-style" className={`rounded-lg border border-border bg-secondary/20 px-3 py-2 space-y-1 ${className}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">口癖</p>
      {rows.map(([k, v], i) => (
        <p key={i} className="text-[11px] leading-relaxed text-foreground/75">
          {k && <span className="text-rose-300/80 mr-1">{k}</span>}
          {k === '招牌台词'
            ? <span className="block space-y-0.5">{v.match(/「[^」]*」/g)?.map((l, j) => <span key={j} className="block italic text-foreground/70">{l}</span>) ?? v}</span>
            : v}
        </p>
      ))}
    </div>
  )
}
