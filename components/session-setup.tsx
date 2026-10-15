'use client'

// 接客 / 调教共用的三步准备向导（阶段 2 只接了接客分支，调教分支在阶段 5）
import { GirlThumb } from '@/components/girl-thumb'
import { GuestPrefs } from '@/components/guest-prefs'
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
import { resolveTraining, getPropSlots, TRAINING_DIRECTIONS, type TrainingResult } from '@/lib/resolve-training'
import { PROF_SKILLS, proficiencyFromLegacy, profShow, profTierLabel, SERVICE_PROF_CAP, type Proficiency } from '@/lib/proficiency'
import { canSkipService, getAvailablePlays, getMainService, scorePlay } from '@/lib/resolve-service'
import { previewService } from '@/lib/settle-session'
import { maxPartners, partnerEligible, PARTNER_STAMINA_MULT } from '@/lib/multi-service'
import { cn } from '@/lib/utils'
import { BottomSheet } from '@/components/bottom-sheet'
import { SERVICE_STEPS } from '@/lib/resolve-service'
import { ALL_PLAYS, STEP_ACTION_MAX } from '@/lib/catalog'
import { flowOptions, raceFlow, getDefaultFlow, hasGirlFlow, defaultFlowChoice, resolveFlow, preferredPlays, FLOW_GIRL, type SessionFlow } from '@/lib/service-flows'

export interface ServicePlan {
  girl: MonstGirl
  guest: Guest
  outfit: OutfitId
  stockings: StockingId
  plays: string[]
  /** 这一场的流程（只影响叙述与推荐，不计分） */
  flow?: SessionFlow
  roomLevel: number
  /** 多人服务：协同（不含主位） */
  partners?: MonstGirl[]
  sessionIndexToday: number
  girlSessionsToday: number
}

interface SessionSetupProps {
  save: GameSave
  onSkip: (plan: ServicePlan) => void
  onLive: (plan: ServicePlan) => void
}

const MAIN_ZONE = { 口侍: '唇舌', 胸侍: '乳房', 身侍: '小穴' } as const
const STEP_TITLES = ['选人', '准备', '确认']

export function SessionSetup({ save, onSkip, onLive }: SessionSetupProps) {
  const { player, girls } = save
  const guests = save.dailyGuests ?? []
  const [step, setStep] = useState(0)
  const [guestId, setGuestId] = useState<string | null>(guests[0]?.id ?? null)
  const [girlId, setGirlId] = useState<string | null>(null)
  const [partnerIds, setPartnerIds] = useState<string[]>([])
  const [outfit, setOutfit] = useState<OutfitId>('regular')
  const [stockings, setStockings] = useState<StockingId>('none')
  const [plays, setPlays] = useState<string[]>([])
  const [flowChoice, setFlowChoice] = useState<string | null>(null)
  const [stepEdits, setStepEdits] = useState<Record<number, string>>({})
  const [playSteps, setPlaySteps] = useState<Record<string, number>>({})
  const [cell, setCell] = useState<number | null>(null)
  const guest = guests.find((g) => g.id === guestId) ?? null
  const girl = girls.find((g) => g.id === girlId) ?? null
  const roomLevel = player.serviceRoomLevel ?? 1
  const partnerCap = maxPartners(roomLevel)
  const partners = partnerIds.map((id) => girls.find((g) => g.id === id)).filter((g): g is MonstGirl => !!g && g.id !== girlId)
  const slots = getPlaySlots(roomLevel)
  const owned = new Set(player.wardrobe ?? [])
  const outfits = OUTFITS.filter((o) => o.id === 'regular' || owned.has(o.id))
  const stockingOpts = STOCKINGS.filter((s) => s.id === 'none' || owned.has(s.id))

  const choice = flowChoice ?? (girl ? defaultFlowChoice(player, girl) : '')
  const resolved = girl ? resolveFlow(player, girl, choice) : null
  const sessionFlow: SessionFlow | undefined = resolved ? {
    choice: resolved.choice,
    name: resolved.name + (Object.values(stepEdits).some((x) => x.trim()) ? '（本场改动）' : ''),
    actions: resolved.actions.map((a, i) => stepEdits[i]?.trim() || a),
    playSteps: Object.fromEntries(plays.map((id) => [id, playSteps[id] ?? 3])),
  } : undefined
  const pickFlow = (c: string) => {
    setFlowChoice(c); setStepEdits({})
    const r = girl ? resolveFlow(player, girl, c) : null
    if (r && guest && r.plays.length) {
      const pp = preferredPlays(r.plays, getAvailablePlays(girl!, guest).map((p) => p.id), slots)
      setPlays(pp.plays); setPlaySteps(pp.playSteps)
    }
  }

  const plan: ServicePlan | null = girl && guest ? {
    girl, guest, outfit, stockings, plays, roomLevel, flow: sessionFlow, ...(partners.length ? { partners } : {}),
    sessionIndexToday: save.actionsUsedToday ?? 0,
    girlSessionsToday: (save.appearedToday ?? []).includes(girl.id) ? 1 : 0,
  } : null
  const preview = useMemo(() => plan ? previewService(plan) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [girl, guest, outfit, stockings, plays.join(','), roomLevel, partnerIds.join(',')])

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
                  <GuestPrefs guest={gu} girls={girl ? [girl, ...partners] : girls} wardrobe={player.wardrobe ?? []} />
                </button>
              ))}
            </section>
            <section className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">魔物娘（主位）</p>
              {girls.map((g) => {
                const main = guest ? getMainService(guest) : null
                const rank = main ? getSkillRank(g, main) : undefined
                const sens = main ? g.sensitivities?.[MAIN_ZONE[main]] : undefined
                const st = g.stamina ?? 100
                return (
                  <button key={g.id} onClick={() => { if (g.id !== girlId) { setFlowChoice(null); setStepEdits({}); setPlaySteps({}) } setGirlId(g.id); setPartnerIds((cur) => cur.filter((x) => x !== g.id)) }} data-testid={`pick-girl-${g.name}`}
                    className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 flex items-center gap-3 transition-colors select-none [&_*]:pointer-events-none',
                      g.id === girlId ? 'border-amber-400/70' : 'border-border hover:border-primary/50')}>
                    <GirlThumb g={g} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold gold-text">{g.name}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">{g.race}</Badge>
                        {(save.appearedToday ?? []).includes(g.id) && <span className="text-[9px] text-amber-300">已出场</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        体力 {st} · 服从 {g.obedience}
                        {main && <> · {main} {rank ?? '未学'} {profShow((g.proficiency ?? proficiencyFromLegacy(g))[main])}</>}
                        {main && sens !== undefined && <> · {MAIN_ZONE[main]} {getSensitivityLevel(sens)}</>}
                      </p>
                    </div>
                    {!canSkipService(g) && <span className="text-[9px] text-rose-400/80 shrink-0">服从不足，不能跳过</span>}
                  </button>
                )
              })}
            </section>
            {girl && girls.length > 1 && (
              <section className="space-y-1.5" data-testid="partner-block">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">协同（可选，最多 {partnerCap} 人 · 同一次行动，各扣主位体力的 {Math.round(PARTNER_STAMINA_MULT * 100)}%）</p>
                <div className="flex flex-wrap gap-1.5">
                  {girls.filter((g) => g.id !== girl.id).map((g) => {
                    const why = partnerEligible(g, girl.id)
                    const on = partnerIds.includes(g.id)
                    return (
                      <button key={g.id} data-testid={`partner-toggle-${g.name}`} disabled={!!why && !on}
                        onClick={() => setPartnerIds((cur) => on ? cur.filter((x) => x !== g.id) : cur.length < partnerCap ? [...cur, g.id] : cur)}
                        className={cn('rounded-md border px-2 py-1 text-[11px] inline-flex items-center gap-1',
                          on ? 'border-pink-400/70 text-pink-200 bg-pink-400/10' : 'border-border text-foreground/80', (why && !on) && 'opacity-40')}>
                        {on ? '✓ ' : '+ '}{g.name}<span className="text-[9px] text-muted-foreground">{why ?? `${g.race} · 体力 ${g.stamina ?? 100}`}</span>
                      </button>
                    )
                  })}
                </div>
                {partnerCap < 2 && <p className="text-[10px] text-muted-foreground">服务房间升到 3 级可以三人同场。</p>}
              </section>
            )}
          </>
        )}

        {step === 1 && plan && (
          <>
            <section className="space-y-1" data-testid="prep-guest-prefs">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{plan.guest.name}的喜好 · 对照{[plan.girl, ...(plan.partners ?? [])].map((g) => g.name).join('、')}与所选服装</p>
              <GuestPrefs guest={plan.guest} girls={[plan.girl, ...(plan.partners ?? [])]} outfit={outfit} stockings={stockings} />
            </section>
            <section className="space-y-2" data-testid="flow-block">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">流程</p>
                <select data-testid="flow-select" value={choice} onChange={(e) => pickFlow(e.target.value)}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] max-w-[60%]">
                  {hasGirlFlow(plan.girl) && <option value={FLOW_GIRL}>{plan.girl.name}的专属做法</option>}
                  {flowOptions(player, plan.girl).filter((o) => o.suggested || !o.builtin).map(({ flow: f, suggested }) => (
                    <option key={f.id} value={f.id}>{suggested ? `★ ${f.name}（${plan.girl.race}推荐）` : `${f.name}${f.id === getDefaultFlow(player)?.id ? '（全馆默认）' : ''}${f.plays?.length ? ' · 偏好 play' : ''}`}</option>
                  ))}
                  <optgroup label="其他种族模板">
                    {flowOptions(player, plan.girl).filter((o) => o.builtin && !o.suggested).map(({ flow: f }) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <FlowStrip actions={plan.flow!.actions} mainLabel={`正戏：${getMainService(plan.guest)}（客人指定）`} playSteps={plan.flow!.playSteps} edited={stepEdits} onCell={setCell} />
              {resolved?.choice === raceFlow(plan.girl.race)?.id && (
                <p className="text-[10px] text-pink-300/80" data-testid="flow-race-hint">按{plan.girl.race}推荐「{resolved!.name}」（内置模板，只改叙述；偏好 play 已尽量预选）</p>
              )}
              <p className="text-[10px] text-muted-foreground">点某一步：只为这一场改做法，或把额外 play 挂到这一步。做法只影响叙述，不计分。</p>
            </section>
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
              {outfits.length === 1 && <p className="text-[10px] text-muted-foreground">衣橱里只有常服，其他服装可在「市场 › 服装」购买。</p>}
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
              <Row label="组合" value={`${[plan.girl, ...(plan.partners ?? [])].map((g) => g.name).join(' + ')} × ${plan.guest.name}`} />
              {preview.skip.synergy !== undefined && <Row label="默契加成" value={`${preview.skip.synergy >= 0 ? '+' : ''}${preview.skip.synergy}（${preview.skip.synergyParts!.join('；')}）`} />}
              {preview.skip.partnerStamina && <Row label="协同体力" value={(plan.partners ?? []).map((p) => `${p.name} −${preview.skip.partnerStamina![p.id]}`).join('，') + `（收入 +${(plan.partners ?? []).length * 20}%）`} />}
              <Row label="服装" value={`${OUTFITS.find((o) => o.id === outfit)?.name}${stockings !== 'none' ? ' + ' + STOCKINGS.find((s) => s.id === stockings)?.name : ''}${preview.skip.outfitMatched ? '（对口）' : plan.guest.prefOutfit ? '（不对口）' : ''}`} />
              <Row label="跳过预计" value={`${preview.skip.tier.label}（满意度 ${preview.skip.satisfaction}）`} />
              <Row label="收入区间" value={`${preview.rewardRange[0]}–${preview.rewardRange[1]} G（跳过 ${preview.skip.reward} G）`} />
              <Row label="体力" value={`跳过 −${preview.skip.staminaCost}；亲自上场 −${preview.liveStamina[0]}～−${preview.liveStamina[1]}（当前 ${plan.girl.stamina ?? 100}）`} />
 {preview.skip.matchBonus > 0 && <Row label="跳过匹配加成" value={`+${preview.skip.matchBonus}（${preview.skip.matchParts.join('，')}）`} />}
              <div className="space-y-1">
                <span className="text-muted-foreground text-[11px]">五步预估（跳过）· {plan.flow?.name}</span>
                <FlowStrip actions={plan.flow!.actions} mainLabel={`正戏：${getMainService(plan.guest)}`} playSteps={plan.flow!.playSteps} scores={preview.skip.steps.map((x) => x.score)} />
              </div>
              {preview.skip.raceNotes.length > 0 && <Row label="种族/状态" value={preview.skip.raceNotes.join('；')} />}
              {preview.skip.plays.length > 0 && <Row label="自动 play" value={preview.skip.plays.map((p) => p.name).join('、')} />}
              <Row label="熟练度" value={`${profGainText(preview.skip.profGains)}（亲自上场 ×1.5；接客最多练到 ${SERVICE_PROF_CAP}）`} />
            </div>
            {!preview.skip.canSkip && (
              <p className="text-[11px] text-rose-400/80">{plan.girl.name} 服从低于 25，只能亲自上场或先去调教。</p>
            )}
          </section>
        )}
      </div>

      <BottomSheet open={cell !== null && step === 1 && !!plan} onClose={() => setCell(null)} testId="flow-cell-sheet"
        title={cell !== null ? `${SERVICE_STEPS[cell].label} · 只改这一场` : ''}>
        {cell !== null && plan && resolved && (
          <>
            <input data-testid="flow-cell-input" value={stepEdits[cell] ?? ''} maxLength={STEP_ACTION_MAX} placeholder={resolved.actions[cell]}
              onChange={(e) => setStepEdits((m) => ({ ...m, [cell]: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
            {cell === 3 && <p className="text-[10px] text-muted-foreground">正戏类型由客人决定：{getMainService(plan.guest)}。</p>}
            {slots > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">挂到这一步的额外 play（共 {slots} 槽，已用 {plays.length}）</p>
                {getAvailablePlays(plan.girl, plan.guest).map((p) => {
                  const on = plays.includes(p.id)
                  const here = on && (playSteps[p.id] ?? 3) === cell
                  return (
                    <button key={p.id} data-testid={`flow-cell-play-${p.id}`}
                      onClick={() => {
                        if (here) { setPlays((cur) => cur.filter((x) => x !== p.id)); return }
                        if (!on && plays.length >= slots) return
                        if (!on) setPlays((cur) => [...cur, p.id])
                        setPlaySteps((m) => ({ ...m, [p.id]: cell }))
                      }}
                      className={cn('w-full flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs',
                        here ? 'border-amber-400/70 text-amber-300' : on ? 'border-border text-foreground/70' : 'border-border', !on && plays.length >= slots && 'opacity-40')}>
                      <span className="flex items-center gap-1.5"><ItemIcon src={playIconPath(p.id)} name={p.name} size={18} />{p.name}</span>
                      <span className="text-[10px]">{here ? '已挂在这一步 · 点击移除' : on ? `在「${SERVICE_STEPS[playSteps[p.id] ?? 3].label}」· 移到这一步` : '挂到这一步'}</span>
                    </button>
                  )
                })}
              </div>
            ) : <p className="text-[10px] text-muted-foreground">服务房间升级后才有额外 play 槽。</p>}
            <button className="w-full h-8 text-xs rounded-lg border border-amber-400/40 text-amber-400" onClick={() => setCell(null)} data-testid="flow-cell-done">完成</button>
          </>
        )}
      </BottomSheet>

      {/* 底部按钮 */}
      <div className="border-t border-border px-4 py-2 flex gap-2 shrink-0">
        {step > 0 && (
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />上一步
          </Button>
        )}
        <div className="flex-1" />
        {step < 2 && (
          <Button size="sm" className="h-9 text-xs glow-btn" disabled={!plan} onClick={() => { if (step === 0 && flowChoice === null && plays.length === 0 && girl) pickFlow(choice); setStep(step + 1) }} data-testid="wizard-next">
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
  skill?: SkillKey
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
  const [skill, setSkill] = useState<SkillKey | undefined>()
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
  const skills: SkillKey[] = girl ? PROF_SKILLS : []
  const prof = girl ? (girl.proficiency ?? proficiencyFromLegacy(girl)) : {}
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
                className={cn('w-full text-left rounded-lg border bg-card px-3 py-2 flex items-center gap-3 transition-colors select-none [&_*]:pointer-events-none',
                  g.id === girlId ? 'border-amber-400/70' : 'border-border hover:border-primary/50')}>
                <GirlThumb g={g} />
                <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold gold-text">{g.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{g.race}</Badge>
                  {RACE_TRAITS[g.race] && <span className="text-[9px] text-amber-300/80">{RACE_TRAITS[g.race]}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  体力 {g.stamina ?? 100} · 服从 {g.obedience} · 淫乱 {g.lewdness} · 好感 {g.affection} · B{g.bust}/W{g.waist}/H{g.hip}
                </p>
                </div>
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
                {potions.length === 0 ? <p className="text-[11px] text-rose-400/80">背包里没有塑形药，先去「市场 › 道具」买。</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {potions.map((p) => <Chip key={p.id} active={potionId === p.id} onClick={() => setPotionId(p.id)} icon={itemIconPath('sculpt', p.id)} label={`${p.name} ×${inv[p.id]}`} />)}
                  </div>
                )}
              </section>
            )}
            {direction === 'drill' && (
              <section className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">特训技能（任何技能都能练，未学的练到 25 就入门）</p>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((k) => (
                    <Chip key={k} active={skill === k} onClick={() => setSkill(k)}
                      label={`${k} ${profTierLabel(prof[k])} ${profShow(prof[k])}`} />
                  ))}
                </div>
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
                : ownedProps.length === 0 && !(player.customProps ?? []).length ? <p className="text-[11px] text-muted-foreground">还没有调教道具，可在「市场 › 道具」购买。</p> : (
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
                {(preview.profChanges ?? []).length > 0 && <Row label="熟练度" value={profChangeText(preview.profChanges!)} />}
                {preview.newRank && <Row label="技能" value={`${preview.profSkill}升到「${preview.newRank}」`} />}
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
    d.sensitivity && `敏感度 +${d.sensitivity}`,
  ].filter(Boolean).join('，')
}

/** 熟练度变化：「胸侍 52→58、M性 30→35」 */
export function profChangeText(changes: NonNullable<TrainingResult['profChanges']>): string {
  return changes.map((c) => `${c.skill} ${profShow(c.from)}→${profShow(c.to)}${c.rankUp ? `（${c.rankUp}！）` : ''}`).join('、')
}

/** 接客熟练度基础增量：「口侍 +2、待客 +1、手技 +1」 */
function profGainText(g: Proficiency): string {
  return Object.entries(g).filter(([, v]) => v).map(([k, v]) => `${k} +${Math.round((v as number) * 10) / 10}`).join('、') || '—'
}

/** 五格步骤带（与亲自上场的 step-bar 同样式）：做法 + 挂上的 play；有分数时显示预估 */
function FlowStrip({ actions, mainLabel, playSteps, scores, edited, onCell }: {
  actions: string[]; mainLabel: string; playSteps?: Record<string, number>; scores?: number[]; edited?: Record<number, string>; onCell?: (i: number) => void
}) {
  return (
    <div className="flex gap-1" data-testid={scores ? 'flow-strip-scores' : 'flow-strip'}>
      {SERVICE_STEPS.map((st, i) => {
        const ps = Object.entries(playSteps ?? {}).filter(([, s]) => s === i).map(([id]) => ALL_PLAYS.find((p) => p.id === id)?.name ?? id)
        return (
          <button key={st.key} disabled={!onCell} onClick={() => onCell?.(i)} data-testid={`flow-cell-${i}`}
            className={cn('flex-1 min-w-0 rounded-md border px-1 py-1 text-center transition-colors',
              edited?.[i]?.trim() ? 'border-amber-400/60 bg-amber-400/10' : 'border-border bg-secondary/20', onCell && 'hover:border-amber-400/50')}>
            <span className="block text-[11px] font-semibold text-foreground/90">{st.label}</span>
            {scores && <span className="block text-[11px] tabular-nums gold-text">{scores[i]}/14</span>}
            <span className="block text-[9px] leading-tight text-muted-foreground line-clamp-3 break-all">{i === 3 ? mainLabel : actions[i]}</span>
            {i === 3 && <span className="block text-[9px] leading-tight text-muted-foreground/80 line-clamp-2 break-all">{actions[3]}</span>}
            {ps.length > 0 && <span className="block text-[9px] text-pink-300 leading-tight">+{ps.join('、')}</span>}
          </button>
        )
      })}
    </div>
  )
}
