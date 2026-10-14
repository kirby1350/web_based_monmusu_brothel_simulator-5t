'use client'

// 调教流程容器：准备向导 → （跳过 | 亲自上场）→ 结算卡
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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

type Phase =
  | { kind: 'setup' }
  | { kind: 'scene'; plan: TrainingPlan }
  | { kind: 'result'; mode: 'skip' | 'live'; before: MonstGirl; result: TrainingResult }

export function TrainingFlow({ save, settings, onSaveChange, onBack }: {
  save: GameSave; settings: AppSettings; onSaveChange: (s: GameSave) => void; onBack: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' })
  const settle = (plan: TrainingPlan, mode: 'skip' | 'live', result: TrainingResult) => {
    if (!result.ok) return
    onSaveChange(applyTrainingToSave(save, result, plan.direction === 'sculpt' ? plan.potionId : undefined))
    setPhase({ kind: 'result', mode, before: plan.girl, result })
  }
  const label = phase.kind === 'setup' ? '准备' : phase.kind === 'scene' ? '进行中' : '结算'
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="w-7 h-7" disabled={phase.kind === 'scene'} onClick={onBack} aria-label="返回">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm font-bold gold-text">调教</h1>
        <Badge variant="secondary" className="text-[10px] h-5 px-2">{label}</Badge>
      </header>
      {phase.kind === 'setup' && (
        <TrainingSetup save={save}
          onSkip={(plan) => settle(plan, 'skip', resolveTraining({ ...plan, skip: true }))}
          onLive={(plan) => setPhase({ kind: 'scene', plan })} />
      )}
      {phase.kind === 'scene' && (
        <TrainingScene player={save.player} girl={phase.plan.girl} settings={settings}
          directionLabel={TRAINING_DIRECTIONS.find((d) => d.key === phase.plan.direction)!.label}
          trainingInfo={trainingContext({ ...phase.plan, skip: true, customProps: save.player.customProps })}
          extraPrompt={phase.plan.direction === 'punish' ? incidentPromptLine(phase.plan.girl) : undefined}
          onFinish={(turns, pleasure) => settle(phase.plan, 'live', resolveLiveTraining(phase.plan, turns, pleasure))} />
      )}
      {phase.kind === 'result' && (
        <TrainingResultCard mode={phase.mode} before={phase.before} result={phase.result} onBack={onBack} />
      )}
    </div>
  )
}
