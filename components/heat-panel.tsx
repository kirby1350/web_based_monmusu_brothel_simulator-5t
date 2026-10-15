'use client'

// 亲自上场：客人与每位魔物娘的兴奋 / 快感（紧凑横条）
import type { Guest, MonstGirl } from '@/lib/types'
import type { Heat, HeatState } from '@/lib/arousal'
import { speechBand } from '@/lib/arousal'
import { PortraitImg } from '@/components/portrait-img'
import { cn } from '@/lib/utils'

function Avatar({ url, label, guest }: { url?: string; label: string; guest?: boolean }) {
  return (
    <div className={cn('w-7 h-7 shrink-0 rounded-full overflow-hidden border flex items-center justify-center text-[11px]', guest ? 'border-sky-400/40 bg-sky-500/10 text-sky-200' : 'border-pink-400/40 bg-pink-500/10 text-pink-200')}>
      {url ? (guest
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={label} className="w-full h-full object-cover object-top" />
        : <PortraitImg url={url} size="sm" sizes="28px" alt={label} className="w-full h-full object-cover object-top" />)
        : label.slice(0, 1)}
    </div>
  )
}

function Bar({ v, cls }: { v: number; cls: string }) {
  return <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className={cn('h-full transition-all duration-500', cls)} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
}

function Row({ name, h, url, guest, just, testId }: { name: string; h: Heat; url?: string; guest?: boolean; just?: boolean; testId: string }) {
  const band = speechBand(h, just)
  return (
    <div className="flex items-center gap-1.5" data-testid={testId}>
      <Avatar url={url} label={name} guest={guest} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1 text-[10px] leading-none">
          <span className={cn('truncate', guest ? 'text-sky-200' : 'text-pink-200')}>{name}</span>
          <span className={cn('rounded px-1', band === '高潮' ? 'bg-rose-500/30 text-rose-200' : band === '临界' ? 'bg-rose-500/15 text-rose-300' : 'text-muted-foreground')}>{band}</span>
          {h.climaxes > 0 && <span className="text-amber-300" title="高潮次数">✦{h.climaxes}</span>}
          <span className="flex-1" />
          <span className="tabular-nums text-muted-foreground">兴 {Math.round(h.arousal)} · 快 {Math.round(h.pleasure)}</span>
        </div>
        <div className="flex gap-1">
          <Bar v={h.arousal} cls="bg-pink-400/80" />
          <Bar v={h.pleasure} cls="bg-amber-400/90" />
        </div>
      </div>
    </div>
  )
}

export function HeatPanel({ heat, guest, girls }: { heat: HeatState; guest: Guest; girls: MonstGirl[] }) {
  return (
    <div className={cn('grid gap-1.5', girls.length > 1 ? 'grid-cols-2' : 'grid-cols-2')} data-testid="heat-panel">
      <Row name={guest.name} h={heat.guest} url={guest.imageUrl} guest just={heat.justClimaxed.includes('guest')} testId="heat-guest" />
      {girls.map((g) => heat.girls[g.id] && <Row key={g.id} name={g.name} h={heat.girls[g.id]} url={g.imageUrl} just={heat.justClimaxed.includes(g.id)} testId={`heat-${g.name}`} />)}
    </div>
  )
}
