'use client'

// 调教流程容器：准备向导 → （跳过 | 亲自上场）→ 结算卡
import { useState } from 'react'
import { ArrowLeft, Settings } from 'lucide-react'
import { AppSettings, GameSave, MonstGirl } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrainingSetup, type TrainingPlan } from '@/components/session-setup'
import { TrainingScene } from '@/components/session-scene'
import { incidentPromptLine } from '@/lib/incidents'
import { trainingContext } from '@/lib/prompt-context'
import { TrainingResultCard } from '@/components/session-result'
import { resolveTraining, resolveLiveTraining, TRAINING_DIRECTIONS, type TrainingResult } from '@/lib/resolve-training'
import { applyTrainingToSave } from '@/lib/settle-session'
import { getScene, rollSkipProvoke } from '@/lib/scenes'
import { recordQuote } from '@/lib/girl-memory'

type Phase =
  | { kind: 'setup' }
  | { kind: 'scene'; plan: TrainingPlan }
  | { kind: 'result'; mode: 'skip' | 'live'; before: MonstGirl; result: TrainingResult; incident?: string }

export function TrainingFlow({ save, settings, onSaveChange, onBack, onOpenSettings }: {
  save: GameSave; settings: AppSettings; onSaveChange: (s: GameSave) => void; onBack: () => void
  /** 设置抽屉是覆盖层：打开/关闭不卸载本页，进行中的调教状态不丢 */
  onOpenSettings?: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const settle = (plan: TrainingPlan, mode: 'skip' | 'live', result: TrainingResult) => {
    if (!result.ok) return
    const next = applyTrainingToSave(save, result, plan.direction === 'sculpt' ? plan.potionId : undefined)
    const inc = next.girls.find((g) => g.id === result.girl.id)?.incident
    onSaveChange(next)
    setPhase({ kind: 'result', mode, before: plan.girl, result, incident: inc && inc !== result.girl.incident ? inc.text : undefined })
  }
  const label = phase.kind === 'setup' ? '准备' : phase.kind === 'scene' ? '进行中' : '结算'
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="w-7 h-7" disabled={phase.kind === 'scene'} onClick={onBack} aria-label="返回">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm font-bold gold-text">调教{phase.kind !== 'setup' && phase.kind === 'scene' && phase.plan.scene ? ` · ${getScene(phase.plan.scene)!.name}` : ''}</h1>
        <Badge variant="secondary" className="text-[10px] h-5 px-2">{label}</Badge>
        <span className="flex-1" />
        {onOpenSettings && (
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onOpenSettings} aria-label="设置" data-testid="btn-settings-inline">
            <Settings className="w-4 h-4" />
          </Button>
        )}
      </header>
      {phase.kind === 'setup' && (
        <TrainingSetup save={save}
          onSkip={(plan) => {
            // 阴影场景里跳过：按阴影层数掷骰，掷中就激发
            const provoke = rollSkipProvoke(plan.girl, plan.scene, save.currentDay) ?? undefined
            settle(plan, 'skip', resolveTraining({ ...plan, skip: true, provoke }))
          }}
          onLive={(plan) => setPhase({ kind: 'scene', plan })} />
      )}
      {phase.kind === 'scene' && (
        <TrainingScene player={save.player} girl={phase.plan.girl} settings={settings}
          directionLabel={TRAINING_DIRECTIONS.find((d) => d.key === phase.plan.direction)!.label}
          scene={phase.plan.scene} day={save.currentDay}
          onRemember={(t) => onSaveChange({ ...save, girls: save.girls.map((g) => (g.id === phase.plan.girl.id ? recordQuote(g, t, save.currentDay) : g)) })}
          trainingInfo={trainingContext({ ...phase.plan, skip: true, customProps: save.player.customProps })}
          extraPrompt={phase.plan.direction === 'punish' ? incidentPromptLine(phase.plan.girl) : undefined}
          onFinish={(turns, pleasure, provoke) => settle(phase.plan, 'live', resolveLiveTraining({ ...phase.plan, provoke }, turns, pleasure))} />
      )}
      {phase.kind === 'result' && (
        <TrainingResultCard mode={phase.mode} before={phase.before} result={phase.result} incident={phase.incident} onBack={onBack} />
      )}
    </div>
  )
}
