'use client'

// 接客 / 调教共用的三步准备向导（阶段 2 只接了接客分支，调教分支在阶段 5）
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FastForward, Swords } from 'lucide-react'
import { CustomProp, GameSave, Guest, MonstGirl, OutfitId, StockingId, TrainingDirection, SkillKey, SensitivityZone, SceneId } from '@/lib/types'
import { TRAINING_SCENES, getScene, sceneReaction, recentUses, hasShadow, fetishProgress, FETISH_THRESHOLD, REACTION_LABEL, shadowLevel, provokeBlock, provokeEffect, SKIP_PROVOKE_CHANCE, PROVOKE_STAMINA } from '@/lib/scenes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OUTFITS, STOCKINGS, getPlaySlots, getSkillRank, getSensitivityLevel, TRAINING_PROPS, SCULPT_POTIONS, COMMON_ZONES, RACE_ZONE_NAMES, RACE_TRAITS, itemIconPath, playIconPath } from '@/lib/catalog'
import { ItemIcon } from '@/components/item-icon'
import { getTemplate } from '@/lib/custom-props'
import { canPunish } from '@/lib/incidents'
import { resolveTraining, getPropSlots, canDrillTwoSided, TRAINING_DIRECTIONS, TWO_SIDED_KEY, type TrainingResult } from '@/lib/resolve-training'
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
  sessionIndexToday: number
  girlSessionsToday: number
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

  const plan: ServicePlan | null = girl && guest ? {
    girl, guest, outfit, stockings, plays, roomLevel,
    sessionIndexToday: save.actionsUsedToday ?? 0,
    girlSessionsToday: (save.appearedToday ?? []).includes(girl.id) ? 1 : 0,
  } : null
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
                    className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 flex items-center gap-3 transition-colors select-none [&_*]:pointer-events-none',
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
                  <Chip key={o.id} active={outfit === o.id} onClick={() => setOutfit(o.id)} icon={itemIconPath('outfit', o.id) ?? ''}
                    label={o.name} hint={plan.guest.prefOutfit && o.pref === plan.guest.prefOutfit ? '对口' : undefined} />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest pt-1">丝袜</p>
              <div className="flex flex-wrap gap-1.5">
                {stockingOpts.map((s) => (
                  <Chip key={s.id} active={stockings === s.id} onClick={() => setStockings(s.id)} icon={s.id === 'none' ? undefined : itemIconPath('stocking', s.id)}
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
                      <span className="flex items-center gap-1.5"><ItemIcon src={playIconPath(p.id)} name={r.name} size={20} />{r.name} <span className="text-muted-foreground text-[10px]">{r.rank}{r.matched ? ' · 对口' : ''}</span></span>
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
 {preview.skip.matchBonus > 0 && <Row label="跳过匹配加成" value={`+${preview.skip.matchBonus}（${preview.skip.matchParts.join('，')}）`} />}
              <Row label="五步预估" value={preview.skip.steps.map((x) => `${x.label}${x.score}`).join(' · ')} />
              {preview.skip.raceNotes.length > 0 && <Row label="种族/状态" value={preview.skip.raceNotes.join('；')} />}
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

function Chip({ active, onClick, label, hint, icon, testId }: { active: boolean; onClick: () => void; label: string; hint?: string; icon?: string; testId?: string }) {
  return (
    <button onClick={onClick} data-testid={testId} className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1.5', icon !== undefined && 'pl-1',
      active ? 'border-amber-400/70 text-amber-300 bg-amber-400/10' : 'border-border text-foreground/80 hover:border-primary/50')}>
      {icon !== undefined && <ItemIcon src={icon || undefined} name={label} size={20} />}
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

// ─── 调教分支 ─────────────────────────────────────────────────────────────────

export interface TrainingPlan {
  girl: MonstGirl
  direction: TrainingDirection
  roomLevel: number
  props: string[]
  customProps?: CustomProp[]
  outfit: OutfitId
  potionId?: string
  skill?: SkillKey | typeof TWO_SIDED_KEY
  zone?: SensitivityZone
  scene?: SceneId
  day?: number
}

interface TrainingSetupProps {
  save: GameSave
  onSkip: (plan: TrainingPlan) => void
  onLive: (plan: TrainingPlan) => void
}

export function TrainingSetup({ save, onSkip, onLive }: TrainingSetupProps) {
  const { player, girls } = save
  const [step, setStep] = useState(0)
  const [girlId, setGirlId] = useState<string | null>(null)
  const [direction, setDirection] = useState<TrainingDirection>('tame')
  const [props, setProps] = useState<string[]>([])
  const [outfit, setOutfit] = useState<OutfitId>('regular')
  const [potionId, setPotionId] = useState<string | undefined>()
  const [skill, setSkill] = useState<SkillKey | typeof TWO_SIDED_KEY | undefined>()
  const [zone, setZone] = useState<SensitivityZone | undefined>()
  const [scene, setScene] = useState<SceneId | undefined>()
  const girl = girls.find((g) => g.id === girlId) ?? null
  const ownedScenes = TRAINING_SCENES.filter((sc) => (player.ownedScenes ?? []).includes(sc.id) && sc.directions.includes(direction))
  const activeScene = ownedScenes.some((sc) => sc.id === scene) ? scene : undefined
  const roomLevel = player.trainingRoomLevel ?? 1
  const slots = getPropSlots(roomLevel)
  const ownedProps = TRAINING_PROPS.filter((p) => (player.ownedTrainingProps ?? []).includes(p.id))
  const inv = player.inventory ?? {}
  const potions = SCULPT_POTIONS.filter((p) => (inv[p.id] ?? 0) > 0)
  const wardrobe = new Set(player.wardrobe ?? [])
  const outfits = OUTFITS.filter((o) => o.id === 'regular' || wardrobe.has(o.id))
  const skills: (SkillKey | typeof TWO_SIDED_KEY)[] = girl ? [
    ...(Object.keys(girl.skillRanks ?? {}) as SkillKey[]),
    ...(canDrillTwoSided(girl) ? [TWO_SIDED_KEY] as const : []),
  ] : []
  const zones: SensitivityZone[] = girl ? [...COMMON_ZONES, ...(RACE_ZONE_NAMES[girl.race] ? ['种族' as SensitivityZone] : [])] : []

  const plan: TrainingPlan | null = girl ? { girl, direction, roomLevel, props, customProps: player.customProps ?? [], outfit, potionId, skill, zone, scene: activeScene, day: save.currentDay } : null
  // 阴影场景里跳过：可能被激发（按层数掷骰，结算时才掷）
  const skipProvokeChance = girl && activeScene && !provokeBlock(girl, activeScene, save.currentDay) ? SKIP_PROVOKE_CHANCE[shadowLevel(girl, activeScene)] : 0
  const preview = plan ? resolveTraining({ ...plan, skip: true }) : null
  const ready = !!preview?.ok

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="training-setup">
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
          <section className="space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">调教对象（一场只安排一名）</p>
            {girls.map((g) => (
              <button key={g.id} onClick={() => setGirlId(g.id)} data-testid={`pick-girl-${g.name}`}
                className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 transition-colors select-none [&_*]:pointer-events-none',
                  g.id === girlId ? 'border-amber-400/70' : 'border-border hover:border-primary/50')}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold gold-text">{g.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{g.race}</Badge>
                  {RACE_TRAITS[g.race] && <span className="text-[9px] text-amber-300/80">{RACE_TRAITS[g.race]}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  体力 {g.stamina ?? 100} · 服从 {g.obedience} · 淫乱 {g.lewdness} · 好感 {g.affection} · B{g.bust}/W{g.waist}/H{g.hip}
                </p>
              </button>
            ))}
          </section>
        )}

        {step === 1 && girl && (
          <>
            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">方向</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TRAINING_DIRECTIONS.filter((d) => d.key !== 'punish' || (girl && canPunish(girl))).map((d) => (
                  <button key={d.key} data-testid={`dir-${d.key}`} onClick={() => setDirection(d.key)}
                    className={cn('rounded-lg border px-2.5 py-1.5 text-left', direction === d.key ? 'border-amber-400/70 bg-amber-400/10' : 'border-border')}>
                    <p className="text-xs">{d.label}</p>
                    <p className="text-[10px] text-muted-foreground">{d.key === 'punish' && girl && !girl.incident ? 'M 性：驯服效果 + 好感 +3' : d.hint}</p>
                  </button>
                ))}
              </div>
            </section>

            {direction === 'sculpt' && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">塑形药（背包）</p>
                {potions.length === 0 ? <p className="text-[11px] text-rose-400/80">背包里没有塑形药，先去大厅「商店」买。</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {potions.map((p) => <Chip key={p.id} active={potionId === p.id} onClick={() => setPotionId(p.id)} icon={itemIconPath('sculpt', p.id)} label={`${p.name} ×${inv[p.id]}`} />)}
                  </div>
                )}
              </section>
            )}
            {direction === 'drill' && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">特训技能</p>
                {skills.length === 0 ? <p className="text-[11px] text-rose-400/80">她还没有选过技能（魔物娘页 · 技能）。</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((k) => (
                      <Chip key={k} active={skill === k} onClick={() => setSkill(k)}
                        label={k === TWO_SIDED_KEY ? '两面' : `${k} ${girl.skillRanks?.[k as SkillKey] ?? ''} · 进度 ${girl.skillProgress?.[k as SkillKey] ?? 0}/2`} />
                    ))}
                  </div>
                )}
              </section>
            )}
            {direction === 'sensitize' && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">敏感带</p>
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((z) => {
                    const v = girl.sensitivities?.[z] ?? 30
                    return <Chip key={z} active={zone === z} onClick={() => setZone(z)}
                      label={`${z === '种族' ? RACE_ZONE_NAMES[girl.race] : z} ${v} ${getSensitivityLevel(v)}`} />
                  })}
                </div>
              </section>
            )}

            {(player.ownedScenes ?? []).length > 0 && (
              <section className="space-y-2" data-testid="scene-picker">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">场景（固定加成，不吃倍率）</p>
                {ownedScenes.length === 0 ? <p className="text-[11px] text-muted-foreground">已有的场景都不适合这个方向。</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip active={!activeScene} onClick={() => setScene(undefined)} label="普通调教室" />
                    {ownedScenes.map((sc) => {
                      const r = sceneReaction(girl, sc.id)
                      const n = recentUses(girl, sc.id, save.currentDay)
                      const tag = [REACTION_LABEL[r], hasShadow(girl, sc.id) ? '阴影' : '', n ? `本周 ${n} 次` : '',
                        r !== 'awakened' ? `${sc.fetish} ${Math.min(fetishProgress(girl, sc.id), FETISH_THRESHOLD)}/${FETISH_THRESHOLD}` : ''].filter(Boolean).join('·')
                      return <Chip key={sc.id} active={activeScene === sc.id} onClick={() => setScene(sc.id)} icon=""
                        label={sc.name} hint={tag || undefined} testId={`scene-${sc.id}`} />
                    })}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">道具（调教室 {roomLevel} 级，最多 {slots} 件）</p>
              {slots === 0 ? <p className="text-[11px] text-muted-foreground">一级调教室没有道具槽，升级调教室后可用。</p>
                : ownedProps.length === 0 && !(player.customProps ?? []).length ? <p className="text-[11px] text-muted-foreground">还没有调教道具，可在大厅「商店」购买。</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {ownedProps.map((p) => {
                    const on = props.includes(p.id)
                    return <Chip key={p.id} active={on} label={p.name} icon={itemIconPath('prop', p.id)}
                      onClick={() => setProps((cur) => on ? cur.filter((x) => x !== p.id) : cur.length < slots ? [...cur, p.id] : cur)} />
                  })}
                  {(player.customProps ?? []).map((c) => {
                    const on = props.includes(c.id)
                    const base = getTemplate(c.templateId)?.baseProp
                    return <Chip key={c.id} active={on} label={c.name} hint="定制" icon={base ? itemIconPath('prop', base) : ''}
                      onClick={() => setProps((cur) => on ? cur.filter((x) => x !== c.id) : cur.length < slots ? [...cur, c.id] : cur)} />
                  })}
                </div>
              )}
            </section>

            {outfits.length > 1 && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">服装（调教不加满意度，部分有固定加成）</p>
                <div className="flex flex-wrap gap-1.5">
                  {outfits.map((o) => <Chip key={o.id} active={outfit === o.id} onClick={() => setOutfit(o.id)} label={o.name} icon={itemIconPath('outfit', o.id) ?? ''} />)}
                </div>
              </section>
            )}
          </>
        )}

        {step === 2 && plan && preview && (
          <section className="space-y-3" data-testid="training-preview">
            {preview.ok ? (
              <div className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs">
                <Row label="方向" value={TRAINING_DIRECTIONS.find((d) => d.key === direction)!.label} />
                {activeScene && <Row label="场景" value={getScene(activeScene)!.name} />}
                {skipProvokeChance > 0 && <p className="text-[10px] text-slate-300" data-testid="skip-provoke-hint">她在这里有阴影：跳过时有 {Math.round(skipProvokeChance * 100)}% 会被激发（服从 +{provokeEffect(plan.girl, activeScene!, save.currentDay).obedience}、体力再 −{PROVOKE_STAMINA}、阴影加深）；亲自上场时，话里触到它也会激发</p>}
                <Row label="成长" value={trainingGains(preview) || '—'} />
                {preview.measurement && <Row label="三围" value={`${{ bust: '胸围', waist: '腰围', hip: '臀围' }[preview.measurement.stat]} ${preview.measurement.from} → ${preview.measurement.to}`} />}
                {preview.newRank && <Row label="技能" value={`升到「${preview.newRank}」`} />}
                {preview.becameTwoSided && <Row label="倾向" value="成为「两面」" />}
                <Row label="体力" value={`−${preview.staminaCost}（当前 ${plan.girl.stamina ?? 100}）`} />
                {preview.notes.length > 0 && <Row label="加成" value={preview.notes.join('；')} />}
                <p className="text-[10px] text-muted-foreground pt-1">亲自上场保底同一份数值；回合多、快感高主项再 +2，只写一两句就结束则减半。</p>
              </div>
            ) : (
              <p className="text-[11px] text-rose-400/80">{preview.error}</p>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 flex gap-2 shrink-0">
        {step > 0 && (
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
          </Button>
        )}
        <div className="flex-1" />
        {step < 2 && (
          <Button size="sm" className="h-9 text-xs glow-btn" disabled={!plan || (step === 1 && !ready)} onClick={() => setStep(step + 1)} data-testid="wizard-next">
            下一步<ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        )}
        {step === 2 && plan && ready && (
          <>
            <Button size="sm" variant="secondary" className="h-9 text-xs" onClick={() => onSkip(plan)} data-testid="btn-skip">
              <FastForward className="w-3.5 h-3.5 mr-1" />跳过
            </Button>
            <Button size="sm" className="h-9 text-xs glow-btn" onClick={() => onLive(plan)} data-testid="btn-live">
              <Swords className="w-3.5 h-3.5 mr-1" />亲自上场
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function trainingGains(r: TrainingResult): string {
  const d = r.delta
  return [
    d.obedience && `服从 +${d.obedience}`, d.lewdness && `淫乱 +${d.lewdness}`, d.affection && `好感 ${d.affection > 0 ? '+' : '−'}${Math.abs(d.affection)}`,
    d.m && `M 进度 +${d.m}`, d.s && `S 进度 +${d.s}`, d.sensitivity && `敏感度 +${d.sensitivity}`, d.skillProgress && `技能进度 +${d.skillProgress}`,
  ].filter(Boolean).join('，')
}
