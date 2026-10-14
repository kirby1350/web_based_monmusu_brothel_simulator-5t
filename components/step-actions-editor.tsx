'use client'

// 五步「标准做法」编辑：每步一行，限 20 字，可恢复默认。只改文字，不影响计分
import { useState } from 'react'
import { SERVICE_STEPS } from '@/lib/resolve-service'
import { STEP_ACTION_MAX } from '@/lib/catalog'
import { normalizeStepActions } from '@/lib/custom-props'
import { cn } from '@/lib/utils'

export function StepActionsEditor({ title, value, placeholders, onSave, testId }: {
  title: string; value?: string[]; placeholders: string[]; onSave: (v: string[] | undefined) => void; testId: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(() => SERVICE_STEPS.map((_, i) => value?.[i] ?? ''))
  const [saved, setSaved] = useState(false)
  const set = (i: number, v: string) => { setSaved(false); setDraft((d) => d.map((x, j) => (j === i ? v : x))) }
  return (
    <div className={cn('rounded-xl border border-border bg-card p-3 space-y-2', 'col-span-2')} data-testid={testId}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">{title}</p>
        <button className="text-[10px] text-amber-400 underline" onClick={() => setOpen(!open)} data-testid={`${testId}-toggle`}>{open ? '收起' : '编辑'}</button>
      </div>
      {open && (
        <>
          {SERVICE_STEPS.map((s, i) => (
            <label key={s.key} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{s.label}</span>
              <input value={draft[i]} maxLength={STEP_ACTION_MAX} placeholder={placeholders[i]} data-testid={`${testId}-${i}`}
                onChange={(e) => set(i, e.target.value)}
                className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-[11px]" />
            </label>
          ))}
          <div className="flex gap-2">
            <button data-testid={`${testId}-reset`} onClick={() => { setDraft(SERVICE_STEPS.map(() => '')); onSave(undefined); setSaved(true) }}
              className="flex-1 text-[10px] rounded-md border border-border px-2 py-1 text-muted-foreground hover:border-primary/50">恢复默认</button>
            <button data-testid={`${testId}-save`} onClick={() => { onSave(normalizeStepActions(draft)); setSaved(true) }}
              className="flex-1 text-[10px] rounded-md border border-amber-400/40 px-2 py-1 text-amber-400 hover:bg-amber-400/10">{saved ? '已保存' : '保存'}</button>
          </div>
          <p className="text-[10px] text-muted-foreground">留空的步骤用灰字做法。只改亲自上场时的推荐和提示词，不影响计分。</p>
        </>
      )}
    </div>
  )
}
