'use client'

// 接客流程容器：准备向导 → （跳过 | 亲自上场场景）→ 结算卡
import { recordQuote } from '@/lib/girl-memory'
import { useState } from 'react'
import { ArrowLeft, Settings } from 'lucide-react'
import { AppSettings, GameSave, Guest } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SessionSetup, type ServicePlan } from '@/components/session-setup'
import { stepActionsWithPlays } from '@/lib/service-flows'
import { ALL_PLAYS } from '@/lib/catalog'
import { SessionScene } from '@/components/session-scene'
import { SessionResult } from '@/components/session-result'
import { mergeRegularMemories } from '@/lib/hub-logic'
import { resolveService, type ServiceResult } from '@/lib/resolve-service'
import { applyServiceToSave, type SettleInfo } from '@/lib/settle-session'
import { resolveLiveSteps } from '@/lib/live-steps'
import { applyPartners } from '@/lib/multi-service'

interface ServiceFlowProps {
  save: GameSave
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onBack: () => void
  /** 设置抽屉是覆盖层：打开/关闭不卸载本页，进行中的接客状态不丢 */
  onOpenSettings?: () => void
}

type Phase =
  | { kind: 'setup' }
  | { kind: 'scene'; plan: ServicePlan }
  | { kind: 'result'; plan: ServicePlan; mode: 'skip' | 'live'; result: ServiceResult; info: SettleInfo; transcript?: string }

export function ServiceFlow({ save, settings, onSaveChange, onBack, onOpenSettings }: ServiceFlowProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })

  const settle = (plan: ServicePlan, mode: 'skip' | 'live', result: ServiceResult, transcript?: string) => {
    const { save: next, info } = applyServiceToSave(save, plan.girl.id, plan.guest, result)
    onSaveChange(next)
    setPhase({ kind: 'result', plan, mode, result, info, transcript })
  }
  // 关系记忆写回：回头客池里有这位客人时同步
  const onSaveRegular = (g: Guest) => {
    if (save.regulars?.some((r) => r.id === g.id)) onSaveChange({ ...save, regulars: mergeRegularMemories(save.regulars, g.id, g.memories ?? {}) })
  }

  const label = phase.kind === 'setup' ? '准备' : phase.kind === 'scene' ? '进行中' : '结算'

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="w-7 h-7" disabled={phase.kind === 'scene'} onClick={onBack} aria-label="返回">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm font-bold gold-text">接客</h1>
        <Badge variant="secondary" className="text-[10px] h-5 px-2">{label}</Badge>
        <span className="flex-1" />
        {onOpenSettings && (
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onOpenSettings} aria-label="设置" data-testid="btn-settings-inline">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </header>

      {phase.kind === 'setup' && (
        <SessionSetup
          save={save}
          onSkip={(plan) => settle(plan, 'skip', applyPartners(resolveService({ ...plan, skip: true }), plan))}
          onLive={(plan) => setPhase({ kind: 'scene', plan })}
        />
      )}
      {phase.kind === 'scene' && (
        <SessionScene
          player={save.player}
          plan={phase.plan}
          wardrobe={save.player.wardrobe ?? []}
          settings={settings}
          cheat={!!save.cheat?.enabled}
          onRemember={(t) => { const ids = [phase.plan.girl.id, ...(phase.plan.partners ?? []).map((p) => p.id)]; onSaveChange({ ...save, girls: save.girls.map((g) => (ids.includes(g.id) ? recordQuote(g, t, save.currentDay) : g)) }) }}
          onFinish={({ state, messages }) => settle({ ...phase.plan, outfit: state.outfit, stockings: state.stockings }, 'live', applyPartners(resolveLiveSteps(phase.plan, state), phase.plan), messages.filter((m) => !m.hidden).map((m) => m.content).join('\n'))}
        />
      )}
      {phase.kind === 'result' && (
        <SessionResult
          mode={phase.mode}
          girl={phase.plan.girl}
          guest={phase.plan.guest}
          outfit={phase.plan.outfit}
          stockings={phase.plan.stockings}
          result={phase.result}
          info={phase.info}
          settings={settings}
          transcript={phase.transcript}
          flowActions={phase.plan.flow ? stepActionsWithPlays(phase.plan.flow.actions, phase.plan.flow.playSteps, (id) => ALL_PLAYS.find((p) => p.id === id)?.name) : undefined}
          onSaveRegular={onSaveRegular}
          onBack={onBack}
        />
      )}
    </div>
  )
}
