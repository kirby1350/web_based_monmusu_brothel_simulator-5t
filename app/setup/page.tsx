'use client'

import { useState } from 'react'
import { nanoid } from 'nanoid'
import { partnerOptions, buildStartingSave, type PartnerOption } from '@/lib/starting-roster'
import { PartnerPick } from '@/components/partner-pick'
import { useRouter } from 'next/navigation'
import { PlayerSetup } from '@/components/player-setup'
import { GirlCreator } from '@/components/girl-creator'
import { Player, MonstGirl } from '@/lib/types'
import { getSettings, saveGameSave } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { applyArchetype, archetypeGirls, getArchetype, getDifficulty } from '@/lib/archetypes'
import { PortraitImg } from '@/components/portrait-img'
import { Button } from '@/components/ui/button'
import { RACE_TRAITS } from '@/lib/catalog'

type SetupStep = 'player' | 'roster' | 'girl' | 'partner'

const STEPS: { key: SetupStep; label: string }[] = [
  { key: 'player', label: '开店' },
  { key: 'girl', label: '开局姑娘' },
  { key: 'partner', label: '第二位' },
]

export default function SetupPage() {
  const router = useRouter()
  const settings = getSettings()
  const [step, setStep] = useState<SetupStep>('player')
  const [player, setPlayer] = useState<Player | null>(null)
  const [first, setFirst] = useState<MonstGirl | null>(null)
  const [options, setOptions] = useState<PartnerOption[]>([])

  const [preset, setPreset] = useState<MonstGirl[]>([])
  const handlePlayerComplete = (p: Player, archetypeId: string, difficultyId: string) => {
    const a = getArchetype(archetypeId)
    setPlayer(applyArchetype(p, a, getDifficulty(difficultyId)))
    if (a.girls.length) { setPreset(archetypeGirls(a, nanoid)); setStep('roster') }
    else setStep('girl')
  }
  const handleRoster = () => {
    if (!player || preset.length < 2) return
    saveGameSave(buildStartingSave(player, preset[0], preset[1], nanoid))
    router.push('/game')
  }

  const handleGirlComplete = (girl: MonstGirl) => {
    setFirst(girl)
    setOptions(partnerOptions(girl.name))
    setStep('partner')
  }

  const handlePartner = (partner: MonstGirl) => {
    if (!player || !first) return
    saveGameSave(buildStartingSave(player, first, partner, nanoid))
    router.push('/game')
  }

  return (
    <div className="min-h-screen bg-[oklch(0.07_0.01_260)] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl min-h-[92vh] max-h-[860px] rounded-xl dungeon-frame bg-background flex flex-col overflow-hidden">

        {/* Header */}
        <header className="border-b border-border px-5 py-3 flex items-center justify-between shrink-0">
          <h1 className="text-sm font-bold gold-text tracking-wide">魔物娘娼馆</h1>

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors',
                    step === s.key || (step === 'roster' && s.key === 'girl')
                      ? 'bg-primary border-primary text-primary-foreground'
                      : i < STEPS.findIndex(x => x.key === step)
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-secondary border-border text-muted-foreground'
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn(
                    'text-xs hidden sm:block transition-colors',
                    step === s.key ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-5 py-6">
          {step === 'player' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-foreground">开店</h2>
                <p className="text-xs text-muted-foreground mt-1">店名、老板名、开局类型与难度；特性和癖好会影响 AI 写的故事</p>
              </div>
              <PlayerSetup onComplete={handlePlayerComplete} />
            </>
          )}
          {step === 'roster' && player && (
            <div className="space-y-3" data-testid="roster-step">
              <div>
                <h2 className="text-base font-bold text-foreground">{player.storeName}的开局阵容</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {getArchetype(player.archetype).label} · {getDifficulty(player.difficulty).label} · {player.gold}G
                  {player.storeTheme ? ` · 主题 ${player.storeTheme}（开业当天就能改）` : ''}
                </p>
              </div>
              {preset.map((g) => (
                <div key={g.id} className="rounded-xl border border-border bg-card p-2.5 flex gap-3" data-testid={`roster-${g.name}`}>
                  <div className="w-[72px] h-24 shrink-0 rounded-lg overflow-hidden border border-border bg-muted/30">
                    {g.imageUrl && <PortraitImg url={g.imageUrl} size="sm" sizes="72px" alt={g.name} className="w-full h-full object-cover object-top" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold gold-text">{g.name} <span className="text-[10px] text-muted-foreground">{g.race}{RACE_TRAITS[g.race] ? ` · ${RACE_TRAITS[g.race]}` : ''}</span></p>
                    <p className="text-[10px] text-muted-foreground line-clamp-3">{g.personality}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 text-xs" onClick={() => setStep('player')}>上一步</Button>
                <Button className="flex-1 h-10 glow-btn" onClick={handleRoster} data-testid="roster-start">开业</Button>
              </div>
            </div>
          )}
          {step === 'girl' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-bold text-foreground">初始魔物娘</h2>
                <p className="text-xs text-muted-foreground mt-1">选择你的第一位魔物娘并自定义她的设定</p>
              </div>
              <GirlCreator settings={settings} onComplete={handleGirlComplete} />
            </>
          )}
          {step === 'partner' && first && (
            <>
              <div className="mb-4">
                <h2 className="text-base font-bold text-foreground">第二位魔物娘</h2>
                <p className="text-xs text-muted-foreground mt-1">三选一，开局金币仍是 500 G</p>
              </div>
              <PartnerPick first={first} options={options} onDone={handlePartner} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
