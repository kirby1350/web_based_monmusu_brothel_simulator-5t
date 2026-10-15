'use client'

// 流程页：全馆默认的五步做法（只影响叙述，不影响计分）+ 哪些魔物娘有自己的做法
import { useState } from 'react'
import { GameSave } from '@/lib/types'
import { StepActionsEditor } from '@/components/step-actions-editor'
import { getStepActions } from '@/lib/custom-props'
import { SERVICE_STEPS } from '@/lib/resolve-service'

export function FlowsScreen({ save, onSaveChange }: { save: GameSave; onSaveChange: (s: GameSave) => void }) {
  const { player, girls } = save
  const [notice, setNotice] = useState('')
  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 2500) }
  const std = getStepActions(player)
  const custom = girls.filter((g) => g.stepActions?.some((x) => x?.trim()))
  return (
    <div className="flex flex-col h-full bg-background relative" data-testid="flows">
      <header className="border-b border-border px-4 py-2.5 shrink-0">
        <h1 className="text-sm font-bold gold-text">服务流程</h1>
        <p className="text-[10px] text-muted-foreground">五步做法只改叙述和亲自上场的推荐，不影响计分</p>
      </header>
      {notice && <div className="mx-4 mt-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs text-primary" data-testid="notice">{notice}</div>}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <section className="rounded-xl border border-border bg-card p-3 space-y-1" data-testid="flow-default">
          <p className="text-xs font-semibold gold-text">全馆默认</p>
          {SERVICE_STEPS.map((s, i) => (
            <p key={s.key} className="text-[11px]"><span className="inline-block w-10 text-muted-foreground">{s.label}</span>{std[i]}</p>
          ))}
        </section>
        <StepActionsEditor title="编辑全馆默认" testId="hub-step-actions" value={player.stepActions} placeholders={getStepActions()}
          onSave={(v) => { onSaveChange({ ...save, player: { ...player, stepActions: v } }); flash(v ? '已更新全馆标准做法' : '全馆标准做法已恢复默认') }} />
        <section className="rounded-xl border border-border bg-card p-3 space-y-1">
          <p className="text-xs font-semibold">有自己做法的魔物娘</p>
          {custom.length === 0 ? <p className="text-[10px] text-muted-foreground">暂无（在魔物娘页的「标准做法（只对她）」里设置）。</p>
            : custom.map((g) => <p key={g.id} className="text-[11px]"><span className="gold-text">{g.name}</span>：{getStepActions(player, g).join(' → ')}</p>)}
        </section>
      </div>
    </div>
  )
}
