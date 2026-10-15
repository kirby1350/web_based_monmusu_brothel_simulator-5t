'use client'

// 会话内作弊：直接设兴奋 / 快感（只在作弊模式开着时出现）
import { useState } from 'react'
import type { HeatState } from '@/lib/arousal'
import { setHeatValues } from '@/lib/cheat'

export function HeatCheat({ heat, people, onChange, align = 'right' }: { heat: HeatState; people: { id: string; name: string }[]; onChange: (h: HeatState) => void; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const inp = 'h-6 w-12 rounded border border-zinc-700 bg-zinc-900 px-1 text-[11px] text-zinc-100'
  const of = (id: string) => (id === 'guest' ? heat.guest : heat.girls[id]) ?? { arousal: 0, pleasure: 0, climaxes: 0 }
  return (
    <div className="relative">
      <button className="h-6 px-2 rounded border border-rose-700/80 bg-rose-950/60 text-[10px] font-semibold text-rose-300" onClick={() => setOpen((v) => !v)} data-testid="heat-cheat">作弊</button>
      {open && (
        <div className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-7 z-50 w-64 rounded-lg border border-rose-900/70 bg-zinc-950 p-2.5 space-y-1.5 shadow-xl`} data-testid="heat-cheat-panel">
          <p className="text-[10px] font-semibold tracking-widest text-rose-400">作弊 · 兴奋 / 快感</p>
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-1 text-[11px] text-zinc-300">
              <span className="truncate">{p.name}</span>
              <span className="flex items-center gap-1">兴奋
                <input type="number" className={inp} value={Math.round(of(p.id).arousal)} data-testid={`heat-a-${p.id}`} onChange={(e) => onChange(setHeatValues(heat, p.id, { arousal: Number(e.target.value) }))} />
                快感
                <input type="number" className={inp} value={Math.round(of(p.id).pleasure)} data-testid={`heat-p-${p.id}`} onChange={(e) => onChange(setHeatValues(heat, p.id, { pleasure: Number(e.target.value) }))} />
              </span>
            </div>
          ))}
          <button className="h-6 px-2 rounded border border-rose-800/70 bg-rose-950/40 text-[10px] text-rose-200" data-testid="heat-cheat-edge"
            onClick={() => onChange(people.reduce((h, p) => setHeatValues(h, p.id, { arousal: 95, pleasure: 95 }), heat))}>全员推到临界</button>
        </div>
      )}
    </div>
  )
}
