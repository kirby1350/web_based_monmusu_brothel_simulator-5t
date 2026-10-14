'use client'

// 接客 / 调教共用的三步准备向导（阶段 2 只接了接客分支，调教分支在阶段 5）
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FastForward, Swords } from 'lucide-react'
import { GameSave, Guest, MonstGirl, OutfitId, StockingId } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OUTFITS, STOCKINGS, getPlaySlots, getSkillRank, getSensitivityLevel } from '@/lib/catalog'
import { canSkipService, getAvailablePlays, getMainService, scorePlay } from '@/lib/resolve-service'
import { previewService } from '@/lib/settle-session'
import { cn } from '@/lib/utils'

export interface ServicePlan {
  girl: MonstGirl
  guest: Guest
  outfit: OutfitId
  stockings: StockingId
  plays: string[]
  roomLevel: number
}

interface SessionSetupProps {
  save: GameSave
  onSkip: (plan: ServicePlan) => void
  onLive: (plan: ServicePlan) => void
}

const KIND_LABEL: Record<string, string> = { M: '想施虐 · M 性对口', S: '想被榨 · S 性对口', 中性: '中性' }
const MAIN_ZONE = { 口侍: '唇舌', 胸侍: '乳房', 身侍: '小穴' } as const
const STEP_TITLES = ['选人', '准备', '确认']

export function SessionSetup({ save, onSkip, onLive }: SessionSetupProps) {
  const { player, girls } = save
  const guests = save.dailyGuests ?? []
  const [step, setStep] = useState(0)
  const [guestId, setGuestId] = useState<string | null>(guests[0]?.id ?? null)
  const [girlId, setGirlId] = useState<string | null>(null)
  const [outfit, setOutfit] = useState<OutfitId>('regular')
  const [stockings, setStockings] = useState<StockingId>('none')
  const [plays, setPlays] = useState<string[]>([])
  const guest = guests.find((g) => g.id === guestId) ?? null
  const girl = girls.find((g) => g.id === girlId) ?? null
  const roomLevel = player.serviceRoomLevel ?? 1
  const slots = getPlaySlots(roomLevel)
  const owned = new Set(player.wardrobe ?? [])
  const outfits = OUTFITS.filter((o) => o.id === 'regular' || owned.has(o.id))
  const stockingOpts = STOCKINGS.filter((s) => s.id === 'none' || owned.has(s.id))

  const plan: ServicePlan | null = girl && guest ? { girl, guest, outfit, stockings, plays, roomLevel } : null
  const preview = useMemo(() => plan ? previewService(plan) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [girl, guest, outfit, stockings, plays.join(','), roomLevel])

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="session-setup">
      {/* 步骤指示 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        {STEP_TITLES.map((t, i) => (
          <div key={t} className={cn('flex items-center gap-1 text-[11px]', i === step ? 'text-amber-300' : i < step ? 'text-foreground/70' : 'text-muted-foreground/50')}>
            <span className={cn('w-4 h-4 rounded-full border flex items-center justify-center text-[9px]', i === step ? 'border-amber-400' : 'border-border')}>{i + 1}</span>
            {t}
            {i < STEP_TITLES.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {step === 0 && (
          <>
            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">客人</p>
              {guests.length === 0 && <p className="text-xs text-muted-foreground">今天没有客人了。</p>}
              {guests.map((gu) => (
                <button key={gu.id} onClick={() => setGuestId(gu.id)} data-testid="pick-guest"
                  className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 space-y-1 transition-colors',
                    gu.id === guestId ? 'border-amber-400/70' : 'border-border hover:border-primary/50')}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold gold-text">{gu.name}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">{gu.race}</Badge>
                    <span className="flex-1" />
                    <span className="text-[10px] gold-text">预算 {gu.budget ?? 80}G</span>
                  </div>
                  <p className="text-[11px] text-foreground/80">{gu.desires}</p>
                  <div className="flex flex-wrap gap-1">
                    {gu.desireService && <Badge variant="secondary" className="text-[9px] h-4 px-1">需求 {gu.desireService}</Badge>}
                    {gu.desireKind && <Badge variant="secondary" className="text-[9px] h-4 px-1">{KIND_LABEL[gu.desireKind]}</Badge>}
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">服装 {gu.prefOutfit ?? '无喜好'}</Badge>
                    {gu.prefRace && <Badge variant="secondary" className="text-[9px] h-4 px-1">偏好 {gu.prefRace}</Badge>}
                    {gu.prefTrait && <Badge variant="secondary" className="text-[9px] h-4 px-1">偏好 {gu.prefTrait}</Badge>}
                  </div>
                </button>
              ))}
            </section>
            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">魔物娘（一场只安排一名）</p>
              {girls.map((g) => {
                const main = guest ? getMainService(guest) : null
                const rank = main ? getSkillRank(g, main) : undefined
                const sens = main ? g.sensitivities?.[MAIN_ZONE[main]] : undefined
                const st = g.stamina ?? 100
                return (
                  <button key={g.id} onClick={() => setGirlId(g.id)} data-testid={`pick-girl-${g.name}`}
                    className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 flex items-center gap-3 transition-colors',
                      g.id === girlId ? 'border-amber-400/70' : 'border-border hover:border-primary/50')}>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold gold-text">{g.name}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{g.race}</Badge>
                        {(save.appearedToday ?? []).includes(g.id) && <span className="text-[9px] text-amber-300">已出场</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        体力 {st} · 服从 {g.obedience}
                        {main && <> · {main} {rank ?? '未学'}</>}
                        {main && sens !== undefined && <> · {MAIN_ZONE[main]} {getSensitivityLevel(sens)}</>}
                      </p>
                    </div>
                    {!canSkipService(g) && <span className="text-[9px] text-rose-400/80 shrink-0">服从不足，不能跳过</span>}
                  </button>
                )
              })}
            </section>
          </>
        )}

        {step === 1 && plan && (
          <>
            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">主装</p>
              <div className="flex flex-wrap gap-1.5">
                {outfits.map((o) => (
                  <Chip key={o.id} active={outfit === o.id} onClick={() => setOutfit(o.id)}
                    label={o.name} hint={plan.guest.prefOutfit && o.pref === plan.guest.prefOutfit ? '对口' : undefined} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-1">丝袜</p>
              <div className="flex flex-wrap gap-1.5">
                {stockingOpts.map((s) => (
                  <Chip key={s.id} active={stockings === s.id} onClick={() => setStockings(s.id)}
                    label={s.name} hint={plan.guest.prefOutfit && s.pref === plan.guest.prefOutfit ? '对口' : undefined} />
                ))}
              </div>
              {outfits.length === 1 && <p className="text-[10px] text-muted-foreground">衣橱里只有常服，其他服装之后在商店购买。</p>}
            </section>
            {slots > 0 && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">额外 play（最多 {slots} 个；跳过时不选会自动填）</p>
                {getAvailablePlays(plan.girl, plan.guest).map((p) => {
                  const r = scorePlay(plan.girl, plan.guest, p)
                  const on = plays.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => setPlays((cur) => on ? cur.filter((x) => x !== p.id) : cur.length < slots ? [...cur, p.id] : cur)}
                      className={cn('w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs', on ? 'border-amber-400/70' : 'border-border')}>
                      <span>{r.name} <span className="text-muted-foreground text-[10px]">{r.rank}{r.matched ? ' · 对口' : ''}</span></span>
                      <span className={r.score < 0 ? 'text-rose-400' : 'gold-text'}>{r.score > 0 ? '+' : ''}{r.score}</span>
                    </button>
                  )
                })}
              </section>
            )}
          </>
        )}

        {step === 2 && plan && preview && (
          <section className="space-y-3" data-testid="session-preview">
            <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs">
              <Row label="组合" value={`${plan.girl.name} × ${plan.guest.name}`} />
              <Row label="服装" value={`${OUTFITS.find((o) => o.id === outfit)?.name}${stockings !== 'none' ? ' + ' + STOCKINGS.find((s) => s.id === stockings)?.name : ''}${preview.skip.outfitMatched ? '（对口）' : plan.guest.prefOutfit ? '（不对口）' : ''}`} />
              <Row label="跳过预计" value={`${preview.skip.tier.label}（满意度 ${preview.skip.satisfaction}）`} />
              <Row label="收入区间" value={`${preview.rewardRange[0]}–${preview.rewardRange[1]} G（跳过 ${preview.skip.reward} G）`} />
              <Row label="体力" value={`跳过 −${preview.skip.staminaCost}；亲自上场 −${preview.liveStamina[0]}～−${preview.liveStamina[1]}（当前 ${plan.girl.stamina ?? 100}）`} />
              {preview.skip.plays.length > 0 && <Row label="自动 play" value={preview.skip.plays.map((p) => p.name).join('、')} />}
            </div>
            {!preview.skip.canSkip && (
              <p className="text-[11px] text-rose-400/80">{plan.girl.name} 服从低于 25，只能亲自上场或先去调教。</p>
            )}
          </section>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="border-t border-border px-4 py-2 flex gap-2 shrink-0">
        {step > 0 && (
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
          </Button>
        )}
        <div className="flex-1" />
        {step < 2 && (
          <Button size="sm" className="h-9 text-xs glow-btn" disabled={!plan} onClick={() => setStep(step + 1)} data-testid="wizard-next">
            下一步<ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
        {step === 2 && plan && (
          <>
            {canSkipService(plan.girl) && (
              <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={() => onSkip(plan)} data-testid="btn-skip">
                <FastForward className="w-3.5 h-3.5 mr-1" />跳过
              </Button>
            )}
            <Button size="sm" className="h-9 text-xs glow-btn" onClick={() => onLive(plan)} data-testid="btn-live">
              <Swords className="w-3.5 h-3.5 mr-1" />亲自上场
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button onClick={onClick} className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors',
      active ? 'border-amber-400/70 text-amber-300 bg-amber-400/10' : 'border-border text-foreground/80 hover:border-primary/50')}>
      {label}{hint && <span className="ml-1 text-[9px] text-emerald-300">{hint}</span>}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
