'use client'
// 称呼卡：她现在怎么叫自己 / 叫你 / 叫自己的身体，来源是什么；能锁定、恢复默认，作弊模式下能直接改。
import { useState } from 'react'
import { Lock, LockOpen, RotateCcw, Pencil } from 'lucide-react'
import type { MonstGirl } from '@/lib/types'
import { addOverrides, resetSlot, toggleLock, TERM_SOURCE_LABEL, CORRUPT_TIERS, type TermSlot } from '@/lib/terms'
import { mmTerms, corruptionOf } from '@/lib/terms-mm'
import { cn } from '@/lib/utils'

const SLOTS: { slot: TermSlot; label: string }[] = [
  { slot: 'self', label: '自称' }, { slot: 'player', label: '叫馆主' }, { slot: 'breast', label: '胸' }, { slot: 'pussy', label: '下面' }, { slot: 'anus', label: '后面' },
]

export function TermsCard({ girl, day, cheat, onChange }: { girl: MonstGirl; day: number; cheat?: boolean; onChange: (g: MonstGirl) => void }) {
  const r = mmTerms(girl, { day })
  const [edit, setEdit] = useState<TermSlot | null>(null)
  const [val, setVal] = useState('')
  const set = (terms: MonstGirl['terms']) => onChange({ ...girl, terms })
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-2" data-testid="terms-card">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold gold-text">称呼</span>
        <span className="text-muted-foreground" data-testid="terms-tier">堕落 {corruptionOf(girl)}（{CORRUPT_TIERS[r.corruptTier]}）{r.boosted ? ' · 淫纹 +1' : ''}</span>
      </div>
      <div className="space-y-1">
        {SLOTS.map(({ slot, label }) => (
          <div key={slot} className="flex items-center gap-2 text-xs" data-testid={`terms-${slot}`}>
            <span className="w-12 text-muted-foreground shrink-0">{label}</span>
            {edit === slot ? (
              <form className="flex-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (val.trim()) set(addOverrides(girl.terms, [{ slot, value: val.trim() }], 'cheat')); setEdit(null) }}>
                <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} className="flex-1 h-6 rounded border border-rose-800/70 bg-zinc-950 px-1.5 text-xs" data-testid="terms-edit-input" />
                <button className="text-[10px] text-rose-300">确定</button>
              </form>
            ) : (
              <span className="flex-1 truncate">「{r[slot].value}」</span>
            )}
            <span className={cn('text-[10px] shrink-0', r[slot].source === 'default' ? 'text-muted-foreground' : 'text-pink-300')}>{TERM_SOURCE_LABEL[r[slot].source]}</span>
            <button title={girl.terms?.locked?.[slot] ? '解锁' : '锁定当前叫法'} aria-label="锁定" onClick={() => set(toggleLock(girl.terms, slot, r[slot].value))} className="text-muted-foreground hover:text-foreground">
              {girl.terms?.locked?.[slot] ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}
            </button>
            <button title="恢复默认" aria-label="恢复默认" onClick={() => set(resetSlot(girl.terms, slot))} className="text-muted-foreground hover:text-foreground"><RotateCcw className="w-3 h-3" /></button>
            {cheat && <button title="作弊改写" aria-label="作弊改写" data-testid={`terms-cheat-${slot}`} onClick={() => { setEdit(slot); setVal(r[slot].value) }} className="text-rose-400"><Pencil className="w-3 h-3" /></button>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">器官叫法随当场快感临时变化，自称和对你的称呼随堕落（服从+淫乱）永久改变；对话里说「以后叫自己XX」「叫我XX」「把你的…叫做XX」她会记住。淫纹体质让叫法再下流一档。</p>
    </div>
  )
}
