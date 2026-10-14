'use client'

// 接客流程容器：准备向导 → （跳过 | 亲自上场场景）→ 结算卡
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { AppSettings, GameSave } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SessionSetup, type ServicePlan } from '@/components/session-setup'
import { SessionScene } from '@/components/session-scene'
import { SessionResult } from '@/components/session-result'
import { resolveService, type ServiceResult } from '@/lib/resolve-service'
import { applyServiceToSave, type SettleInfo } from '@/lib/settle-session'
import { resolveLiveSteps } from '@/lib/live-steps'

interface ServiceFlowProps {
  save: GameSave
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onBack: () => void
}

type Phase =
  | { kind: 'setup' }
  | { kind: 'scene'; plan: ServicePlan }
  | { kind: 'result'; plan: ServicePlan; mode: 'skip' | 'live'; result: ServiceResult; info: SettleInfo }

export function ServiceFlow({ save, settings, onSaveChange, onBack }: ServiceFlowProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })

  const settle = (plan: ServicePlan, mode: 'skip' | 'live', result: ServiceResult) => {
    const { save: next, info } = applyServiceToSave(save, plan.girl.id, plan.guest, result)
    onSaveChange(next)
    setPhase({ kind: 'result', plan, mode, result, info })
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
      </header>

      {phase.kind === 'setup' && (
        <SessionSetup
          save={save}
          onSkip={(plan) => settle(plan, 'skip', resolveService({ ...plan, skip: true }))}
          onLive={(plan) => setPhase({ kind: 'scene', plan })}
        />
      )}
      {phase.kind === 'scene' && (
        <SessionScene
          player={save.player}
          plan={phase.plan}
          wardrobe={save.player.wardrobe ?? []}
          settings={settings}
          onFinish={({ state }) => settle({ ...phase.plan, outfit: state.outfit, stockings: state.stockings }, 'live', resolveLiveSteps(phase.plan, state))}
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
          onBack={onBack}
        />
      )}
    </div>
  )
}
