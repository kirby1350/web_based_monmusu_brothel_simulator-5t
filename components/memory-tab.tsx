'use client'

// 魔物娘页「回忆」：心里话、馆主说过的话、第一次、熟客、时间线；可以删掉任意一条
import { X } from 'lucide-react'
import type { MonstGirl } from '@/lib/types'
import { memOf, removeEvent, removeQuote, type MemoryKind } from '@/lib/girl-memory'
import { cn } from '@/lib/utils'

const KIND_LABEL: Record<MemoryKind, string> = {
  first: '第一次', arrival: '入馆', training: '调教', service: '接客', gift: '礼物', incident: '事件', punish: '惩罚', quote: '你的话', milestone: '变化', awaken: '觉醒', shadow: '阴影',
}
const KIND_COLOR: Partial<Record<MemoryKind, string>> = {
  first: 'text-amber-300', arrival: 'text-amber-300', awaken: 'text-fuchsia-300', gift: 'text-pink-300', incident: 'text-rose-300', punish: 'text-rose-300', quote: 'text-emerald-300', milestone: 'text-sky-300',
}

export function MemoryTab({ girl, onChange }: { girl: MonstGirl; onChange: (g: MonstGirl) => void }) {
  const m = memOf(girl)
  const timeline = m.events.map((e, i) => ({ e, i })).sort((a, b) => b.e.day - a.e.day || b.i - a.i)
  const tally = Object.values(m.guestTally).sort((a, b) => b.count - a.count)
  const empty = !m.events.length && !m.summary && !m.quotes.length
  return (
    <div className="space-y-3" data-testid="memory-tab">
      {empty && <p className="text-[11px] text-muted-foreground">她还没有什么特别的回忆。接客、调教、送礼、闲聊时点「让她记住」都会留下记忆。</p>}
      {m.summary && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1" data-testid="memory-summary">
          <p className="text-[10px] text-amber-300">心里话 · 第 {m.summaryDay} 天{m.aiDay === m.summaryDay ? '' : '（本地整理）'}</p>
          <p className="text-xs leading-relaxed">{m.summary}</p>
        </div>
      )}
      {m.quotes.length > 0 && (
        <section className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">你让她记住的话（{m.quotes.length}/5）</p>
          {m.quotes.map((q) => (
            <div key={q.text} className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5">
              <p className="flex-1 text-xs">「{q.text}」<span className="text-[10px] text-muted-foreground ml-1">第 {q.day} 天</span></p>
              <button aria-label="忘掉这句" className="text-muted-foreground hover:text-rose-300" onClick={() => onChange(removeQuote(girl, q.text))}><X className="w-3 h-3" /></button>
            </div>
          ))}
        </section>
      )}
      {tally.length > 0 && (
        <p className="text-[11px] text-muted-foreground" data-testid="memory-tally">
          熟客：{tally.map((t) => `${t.name}×${t.count}（最好 ${t.bestSat}）`).join('、')}
        </p>
      )}
      {timeline.length > 0 && (
        <section className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">时间线（普通 14 天、重要 30 天后淡忘，「第一次」不忘）</p>
          {timeline.map(({ e, i }) => (
            <div key={`${i}-${e.day}-${e.text}`} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-2.5 py-1.5" data-testid="memory-event">
              <span className="text-[10px] text-muted-foreground w-10 shrink-0 pt-px">第{e.day}天</span>
              <span className={cn('text-[10px] w-10 shrink-0 pt-px', KIND_COLOR[e.kind] ?? 'text-foreground/60')}>{KIND_LABEL[e.kind]}{e.w === 3 ? '★' : ''}</span>
              <p className="flex-1 text-xs leading-snug">{e.text.replace(/^第\d+天(夜里)?/, (m, n) => (n ? "夜里" : ""))}</p>
              <button aria-label="删除这条记忆" className="text-muted-foreground hover:text-rose-300" onClick={() => onChange(removeEvent(girl, i))}><X className="w-3 h-3" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
