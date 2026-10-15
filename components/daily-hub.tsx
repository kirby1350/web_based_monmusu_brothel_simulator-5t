'use client'

import { bodyTraitsOf, getBodyTrait, bodyTraitLabel } from '@/lib/body-traits'
import { useEffect, useState } from 'react'
import { Settings, Coins, Calendar, Store, Sword, Moon, Zap } from 'lucide-react'
import { GameSave, MonstGirl, AppSettings } from '@/lib/types'
import { ImageDisplay } from '@/components/image-display'
import { GirlSheet } from '@/components/girl-sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MAX_ACTIONS_PER_DAY } from '@/lib/game-engine'
import { endDay, nightPlan, unusedActions, getDormInfo, pickArrivalLeader, arrivalFallbackText, arrivalPromptNote } from '@/lib/hub-logic'
import { IDLE_REST_BONUS, UNUSED_ACTION_REST_BONUS } from '@/lib/catalog'
import { clearOpeningCache, getOpeningCache, saveOpeningCache } from '@/lib/storage'
import { contextImageTags, hubOpeningPrompt } from '@/lib/prompt-context'
import { dismissDaySummary } from '@/lib/day-summary'
import { TUTORIAL_STEPS, isTutorialVisible, advanceTutorial, dismissTutorial } from '@/lib/tutorial'
import { cn } from '@/lib/utils'
import { GuestPrefs } from '@/components/guest-prefs'
import { getTheme } from '@/lib/store-theme'
import { BottomSheet } from '@/components/bottom-sheet'
import { refreshGuests, refreshCost, refreshesUsed, parseGuestBias, REFRESH_LIMIT, EARLY_GUARANTEE_DAYS } from '@/lib/guest-gen'
import type { GameTab } from '@/app/game/page'
import { speechLine, speechRuleFor } from '@/lib/speech-style'

interface DailyHubProps {
  save: GameSave
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onNavigate: (tab: GameTab) => void
  onOpenSettings: () => void
  /** 作弊模式开着时，顶栏多一个「作弊」入口 */
  onOpenCheat?: () => void
  newlyPurchasedGirl?: MonstGirl | null
  onNewGirlGreeted?: () => void
}


export function DailyHub({ save, settings, onSaveChange, onNavigate, onOpenSettings, onOpenCheat, newlyPurchasedGirl, onNewGirlGreeted }: DailyHubProps) {
  const { player, girls } = save
  const [openGirlId, setOpenGirlId] = useState<string | null>(null)
  const [endDayOpen, setEndDayOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [biasOpen, setBiasOpen] = useState(false)
  const [biasText, setBiasText] = useState('')

  const [intro, setIntro] = useState<{ girlId: string; speaker: string; text: string; loading: boolean } | null>(null)

  // 新买的魔物娘：打开她的魔物娘页，并由好感最高（≥50）的魔物娘或馆主带她入馆
  // 第 2 天起的开场白：懒加载、按天缓存；模型不可用时静默不显示
  const [opening, setOpening] = useState<string>(() => { const c = getOpeningCache(); return c && c.day === save.currentDay ? c.text : '' })
  useEffect(() => {
    let ignore = false
    const cache = getOpeningCache()
    if (cache?.day === save.currentDay) { setOpening(cache.text); return }
    setOpening('')
    const timer = setTimeout(async () => {
      try {
        const prompt = await hubOpeningPrompt(save, cache?.day ?? null)
        if (!prompt || ignore) return
        const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }) })
        const data = res.ok ? await res.json().catch(() => null) : null
        const text = String(data?.content ?? '').trim()
        // 失败也记一笔空缓存：当天不再重试，避免每次回大厅都报一次 500
        saveOpeningCache(save.currentDay, text)
        if (text && !ignore) setOpening(text)
      } catch { saveOpeningCache(save.currentDay, '') /* 离线：静默不显示开场白 */ }
    }, 800)
    return () => { ignore = true; clearTimeout(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.currentDay])

  useEffect(() => {
    if (!newlyPurchasedGirl) return
    const ng = newlyPurchasedGirl
    setOpenGirlId(ng.id)
    onNewGirlGreeted?.()
    const leader = pickArrivalLeader(save.girls, ng.id)
    const speaker = leader.kind === 'girl' ? leader.girl.name : save.player.name
    const fallback = arrivalFallbackText(leader, save.player.name, ng)
    setIntro({ girlId: ng.id, speaker, text: '', loading: true })
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const prompt = `${arrivalPromptNote(leader, save.player.name, ng)}\n新人：${ng.name}（${ng.race}，性格：${ng.personality}${speechLine(ng, '；')}）。用中文写一段80~150字的入馆场景，含两三句对白。${speechRuleFor([ng, ...(leader.kind === 'girl' ? [leader.girl] : [])], '')}只输出正文，不要输出数据块。`
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
    })
      .then(async (r) => (r.ok ? ((await r.json()).content ?? '').trim() : ''))
      .catch(() => '')
      .then((text: string) => setIntro({ girlId: ng.id, speaker, text: text || fallback, loading: false }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyPurchasedGirl])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3000) }

  const actionsUsed = save.actionsUsedToday ?? 0
  const actionsLeft = Math.max(0, MAX_ACTIONS_PER_DAY - actionsUsed)
  const noActionsLeft = actionsLeft <= 0
  const guests = save.dailyGuests ?? []
  const appeared = new Set(save.appearedToday ?? [])
  const openGirl = girls.find((g) => g.id === openGirlId) ?? null

  const handleEndDay = () => {
    setEndDayOpen(false)
    clearOpeningCache()
    onSaveChange(endDay(save))
    flash(`第 ${save.currentDay + 1} 天开始了，大家休整了一晚`)
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* 顶栏：天数 / 金币 / 剩余行动 */}
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="day">
          <Calendar className="w-3.5 h-3.5" />{player.storeName ? <span className="text-foreground/80 max-w-[7em] truncate" data-testid="store-name-hub">{player.storeName}</span> : null}第 {save.currentDay} 天
        </span>
        <span className="flex items-center gap-1.5" data-testid="gold">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs gold-text font-semibold">{player.gold} G</span>
        </span>
        <span className={cn('flex items-center gap-1 text-xs', noActionsLeft ? 'text-rose-400' : 'text-emerald-300')} data-testid="actions">
          <Zap className="w-3.5 h-3.5" />行动 {actionsLeft}/{MAX_ACTIONS_PER_DAY}
        </span>
        {save.cheat?.enabled && onOpenCheat && (
          <button className="h-6 px-2 rounded border border-rose-700/80 bg-rose-950/60 text-[10px] font-semibold text-rose-300 hover:bg-rose-900/60" onClick={onOpenCheat} data-testid="hub-cheat">作弊</button>
        )}
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
        </Button>
      </header>

      {/* 昨日小结（结束今天后弹出，关闭即清空） */}
      {save.lastDaySummary && (() => {
        const d = save.lastDaySummary
        const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
        return (
          <div className="absolute inset-0 z-30 bg-black/60 flex items-start justify-center pt-16 px-4" data-testid="day-summary" onClick={() => onSaveChange(dismissDaySummary(save))}>
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold gold-text">第 {d.day} 天小结</span>
                <span className="text-muted-foreground">声望 {sign(d.repDelta)}</span>
              </div>
              <p>收入 <span className="gold-text font-semibold">{d.income} G</span>{d.spent ? <span className="text-muted-foreground">　支出 {d.spent} G</span> : null}</p>
              <p>接客 {Object.values(d.tiers).reduce((a, b) => a + b, 0)} 场{Object.keys(d.tiers).length ? '：' + Object.entries(d.tiers).map(([k, v]) => `${k}×${v}`).join('、') : ''}</p>
              {d.best && <p>最佳：{d.best.girl}（{d.best.sat}，{d.best.guest}）</p>}
              {d.regulars.length > 0 && <p>回头客：{d.regulars.map((r) => `${r.guest}${r.rolled ? '✔' : `（${r.sat}，差一点）`}`).join('、')}</p>}
              {d.incidents.length > 0 && <p className="text-rose-300">事件：{d.incidents.map((x) => `${x.status === '已处理' ? '✔已处理 ' : ''}${x.girl}${x.kind}·${x.text}`).join('；')}</p>}
              {!!d.unresolved && <p className="text-rose-300/70">仍有 {d.unresolved} 件旧事件未处理</p>}
              {!!d.upkeep && <p className="text-muted-foreground" data-testid="day-upkeep">调教场景维护 −{d.upkeep} G</p>}
              {d.night && <p className="text-muted-foreground" data-testid="day-night">{d.night}</p>}
              {d.rest && <p className="text-emerald-300/90" data-testid="day-rest">休养：{d.rest}</p>}
              {d.bodyTraits && <p className="text-fuchsia-300/90" data-testid="day-body-traits">体质：{d.bodyTraits}</p>}
              {d.stats.length > 0 && <p className="text-muted-foreground">{d.stats.map((x) => `${x.girl} ${[x.ob && `服${sign(x.ob)}`, x.lw && `淫${sign(x.lw)}`, x.aff && `好${sign(x.aff)}`].filter(Boolean).join(' ')}`).join('｜')}</p>}
              <div className="flex justify-end pt-1">
                <button className="text-primary font-semibold" data-testid="day-summary-close" onClick={() => onSaveChange(dismissDaySummary(save))}>知道了</button>
              </div>
            </div>
          </div>
        )
      })()}

      {opening && <p className="mx-3 mt-2 text-[11px] italic text-muted-foreground leading-relaxed shrink-0" data-testid="hub-opening">{opening}</p>}

      {/* 第一天新手引导（可跳过，进度存档） */}
      {isTutorialVisible(save) && (() => {
        const i = Math.min(save.tutorial!.step, TUTORIAL_STEPS.length - 1)
        const st = TUTORIAL_STEPS[i]
        const last = i === TUTORIAL_STEPS.length - 1
        return (
          <div className="mx-3 mt-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 shrink-0" data-testid="tutorial">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">{st.title}</span>
              <span className="text-[10px] text-muted-foreground">{i + 1}/{TUTORIAL_STEPS.length}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{st.body}</p>
            <div className="flex justify-end gap-2 mt-1.5">
              {!last && <button className="text-[11px] text-muted-foreground hover:text-foreground" data-testid="tutorial-skip" onClick={() => onSaveChange(dismissTutorial(save))}>跳过引导</button>}
              <button className="text-[11px] text-primary font-semibold" data-testid="tutorial-next" onClick={() => onSaveChange(advanceTutorial(save))}>{last ? '开始经营' : '下一步 →'}</button>
            </div>
          </div>
        )
      })()}

      {/* 魔物娘横条 */}
      <div className="border-b border-border px-3 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {girls.length === 0 && (
            <button className="text-xs text-muted-foreground px-2 py-3" onClick={() => onNavigate('market')}>馆内还没有魔物娘，去奴隶市场看看 →</button>
          )}
          {girls.map((g) => {
            const st = g.stamina ?? 100
            return (
              <div key={g.id} role="button" tabIndex={0} data-testid={`girl-${g.name}`} onClick={() => setOpenGirlId(g.id)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpenGirlId(g.id) } }}
                className={cn('w-16 shrink-0 rounded-lg border bg-card p-1 text-left transition-colors cursor-pointer',
                  'border-border hover:border-primary/50')}>
                <div className="relative w-full aspect-square rounded-md overflow-hidden">
                  <ImageDisplay tags={contextImageTags(g, { exhausted: g.exhausted || (g.stamina ?? 100) < 30, incident: !!g.incident })} settings={settings} cachedUrl={g.imageUrl}
                    onUrlCached={(url) => onSaveChange({ ...save, girls: girls.map((x) => x.id === g.id ? { ...x, imageUrl: url } : x) })}
                    alt={g.name} size="sm" className="w-full h-full object-cover" />
                  {appeared.has(g.id) && <span className="absolute top-0 right-0 text-[8px] bg-black/70 text-amber-300 px-1 rounded-bl">已出场</span>}
                  {(() => { const pt = bodyTraitsOf(g, save.currentDay).filter((t) => t.daysLeft !== undefined); return pt.length ? (
                    <span data-testid={`potion-mark-${g.name}`} title={pt.map(bodyTraitLabel).join('、')} className="absolute top-0 left-0 text-[8px] bg-fuchsia-700/85 text-white px-1 rounded-br">{getBodyTrait(pt[0].id)!.name}·{pt[0].daysLeft}天{pt.length > 1 ? '+' : ''}</span>
                  ) : null })()}
                  {g.incident && <span data-testid={`incident-mark-${g.name}`} title={`${g.incident.kind}：${g.incident.text}`} className="absolute bottom-0 left-0 text-[8px] bg-rose-600/85 text-white px-1 rounded-tr">{g.incident.kind === '闯祸' ? '闯祸' : '失败'}</span>}
                </div>
                <p className="text-[10px] truncate mt-0.5 gold-text">{g.name}</p>
                <div className="h-1 rounded-full bg-secondary overflow-hidden" title={`体力 ${st}`}>
                  <div className={cn('h-full', st >= 50 ? 'bg-emerald-400' : st >= 25 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: `${st}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground" data-testid={`stamina-${g.name}`}>体力 {st}</p>
              </div>
            )
          })}
        </div>
      </div>

      {notice && <div className="mx-4 mt-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-1.5 text-xs text-primary" data-testid="notice">{notice}</div>}

      {/* 今日客人（设施 / 商店 已移到底部导航的「设施」「市场」） */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="mx-4 mt-2 flex items-center gap-1.5 shrink-0">
          <p className="text-xs font-semibold gold-text">今日客人（{guests.length}）</p>
          <span className="flex-1" />
          {(() => {
            const c = refreshCost(save, false), ct = refreshCost(save, true)
            const left = REFRESH_LIMIT - refreshesUsed(save)
            const fresh = guests.some((g) => !(g.visits ?? 0))
            return (<>
              <button data-testid="btn-guest-refresh" disabled={c === null || !fresh || player.gold < (c ?? 0)}
                onClick={() => { const r = refreshGuests(save, null); if ('error' in r) flash(r.error); else { onSaveChange(r.save); flash(`换了一批客人（−${r.cost}G，今天还能换 ${left - 1} 次）`) } }}
                className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-foreground/80 disabled:opacity-40">换一批 {c !== null ? `${c}G` : ''}</button>
              <button data-testid="btn-guest-target" disabled={ct === null || !fresh}
                onClick={() => setBiasOpen(true)}
                className="rounded-md border border-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-300 disabled:opacity-40">定向 {ct !== null ? `${ct}G` : ''}</button>
              <span className="text-[9px] text-muted-foreground">{left}/{REFRESH_LIMIT}</span>
            </>)
          })()}
        </div>
        {getTheme(player.storeTheme) && <p className="mx-4 text-[9px] text-pink-300/80 shrink-0" data-testid="hub-theme">主题：{getTheme(player.storeTheme)!.label}（冲突的客人不上门）</p>}
        {save.currentDay <= EARLY_GUARANTEE_DAYS && <p className="mx-4 text-[9px] text-muted-foreground shrink-0">开业头 {EARLY_GUARANTEE_DAYS} 天：至少有一位客人适合馆里的姑娘。</p>}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          <div className="space-y-2" data-testid="guest-list">
            {guests.length === 0 && <p className="text-xs text-muted-foreground">今天的客人都接待完了。</p>}
            {guests.map((gu) => (
              <div key={gu.id} className="rounded-lg border border-border bg-card px-3 py-2 space-y-1" data-testid="guest-card">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold gold-text">{gu.name}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{gu.race}</Badge>
                  {(gu.visits ?? 0) > 0 && <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-pink-500/15 text-pink-300">回头客</Badge>}
                  <span className="flex-1" />
                  <span className="text-[10px] gold-text">预算 {gu.budget ?? 80}G</span>
                </div>
                <p className="text-[11px] text-foreground/80">{gu.desires}</p>
                <GuestPrefs guest={gu} girls={girls} wardrobe={player.wardrobe ?? []} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部三个按钮（休息并入结束今天） */}
      <div className="border-t border-border px-4 py-2 shrink-0">
        {noActionsLeft && <p className="text-[10px] text-rose-400/80 text-center mb-1.5">今日行动已用尽，点击「结束今天」进入下一天</p>}
        <div className="grid grid-cols-3 gap-2">
          <ActionButton icon={Store} label="接客" color="primary" onClick={() => onNavigate('service')}
            disabled={girls.length === 0 || noActionsLeft || guests.length === 0} />
          <ActionButton icon={Sword} label="调教" color="rose" onClick={() => onNavigate('training')}
            disabled={girls.length === 0 || noActionsLeft} />
          <ActionButton icon={Moon} label="结束今天" color="amber" onClick={() => setEndDayOpen(true)} testId="btn-endday" />
        </div>
      </div>

      <BottomSheet open={biasOpen} onClose={() => setBiasOpen(false)} testId="guest-bias-sheet" title={`定向换客人（${refreshCost(save, true) ?? '—'}G，和「换一批」共用每天 ${REFRESH_LIMIT} 次）`}>
        {(() => {
          const parsed = parseGuestBias(biasText)
          const races = [...new Set(girls.map((g) => g.race))]
          const chips = [...races.map((r) => `喜欢${r}`), '巨乳', '贫乳', '丰臀', '兽耳', '口侍', '胸侍', '身侍', 'M', 'S',
            // 馆里有人有的体质（定向找偏好这项体质的客人）
            ...[...new Set(save.girls.flatMap((g) => bodyTraitsOf(g, save.currentDay).map((t) => getBodyTrait(t.id)!.name)))]]
          const cost = refreshCost(save, true)
          return (
            <div className="space-y-2">
              <input data-testid="guest-bias-input" value={biasText} onChange={(e) => setBiasText(e.target.value)} placeholder="例：喜欢牛娘、巨乳、胸侍、M"
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <div className="flex flex-wrap gap-1">
                {chips.map((c) => (
                  <button key={c} data-testid={`bias-chip-${c}`} onClick={() => setBiasText((t) => t.includes(c) ? t : (t.trim() ? `${t.trim()}、${c}` : c))}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground/80 hover:border-amber-400/50">{c}</button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground" data-testid="guest-bias-parsed">
                {parsed.labels.length ? `会偏向：${parsed.labels.join('、')}（强偏向，不保证每位都对上）` : '没认出偏好：可以写种族、巨乳/贫乳/丰臀/兽耳、口侍/胸侍/身侍、M/S、服装喜好。'}
              </p>
              {getTheme(player.storeTheme) && <p className="text-[10px] text-pink-300/80">店铺主题「{getTheme(player.storeTheme)!.label}」优先：和主题冲突的偏好会被改掉。</p>}
              <button data-testid="guest-bias-confirm" disabled={!parsed.labels.length || cost === null || player.gold < (cost ?? 0)}
                onClick={() => { const r = refreshGuests(save, parsed); if ('error' in r) flash(r.error); else { onSaveChange(r.save); flash(`按「${parsed.labels.join('、')}」换了一批客人（−${r.cost}G）`) } setBiasOpen(false) }}
                className="w-full h-8 text-xs rounded-lg border border-amber-400/40 text-amber-400 disabled:opacity-40">换一批（{cost ?? '—'}G）</button>
            </div>
          )
        })()}
      </BottomSheet>

      {endDayOpen && <EndDaySheet save={save} onCancel={() => setEndDayOpen(false)} onConfirm={handleEndDay} />}

      {openGirl && (
        <GirlSheet key={openGirl.id} girl={openGirl} save={save} settings={settings} onSaveChange={onSaveChange} onClose={() => { setOpenGirlId(null); setIntro(null) }} intro={intro && intro.girlId === openGirl.id ? intro : null} />
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, color, onClick, disabled, testId }: {
  icon: typeof Store
  label: string
  color: 'primary' | 'rose' | 'amber' | 'emerald'
  onClick: () => void
  disabled?: boolean
  testId?: string
}) {
  const c = {
    primary: 'bg-primary/10 hover:bg-primary/20 border-primary/30 hover:border-primary/60 text-primary',
    rose: 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 hover:border-rose-500/60 text-rose-400',
    amber: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 hover:border-amber-500/60 text-amber-400',
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400',
  }[color]
  return (
    <button data-testid={testId}
      className={cn('flex items-center justify-center gap-1.5 rounded-xl border py-2.5 transition-all duration-150 text-xs font-medium', c, disabled && 'opacity-40 pointer-events-none')}
      onClick={onClick} disabled={disabled}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

/** 结束今天的确认抽屉：预览每个人明早的体力（宿舍 / 休养 / 挂机分开写） */
function EndDaySheet({ save, onCancel, onConfirm }: { save: GameSave; onCancel: () => void; onConfirm: () => void }) {
  const plan = nightPlan(save)
  const left = unusedActions(save)
  const dorm = getDormInfo(save.player.dormLevel)
  return (
    <div className="absolute inset-0 z-40 bg-black/60 flex items-end" data-testid="endday-sheet" onClick={onCancel}>
      <div className="w-full rounded-t-2xl border-t border-border bg-card px-4 pt-3 pb-4 space-y-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/30" />
        <p className="text-sm font-bold gold-text">结束第 {save.currentDay} 天</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          宿舍「{dorm.name}」每晚 +{dorm.nightly}{dorm.clearsExhaustion ? '、解除疲惫' : ''}。
          {left > 0 ? <span className="text-emerald-300"> 还剩 {left} 次行动没用：全员再 +{left * UNUSED_ACTION_REST_BONUS}。</span> : ' 行动已用完。'}
          今天没出场的人 +{IDLE_REST_BONUS} 并解除疲惫。
        </p>
        <div className="space-y-1">
          {plan.map((p) => (
            <div key={p.girlId} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-1.5 text-xs" data-testid={`endday-${p.name}`}>
              <span className="w-16 truncate gold-text">{p.name}</span>
              <span className="flex-1 text-[10px] text-muted-foreground">
                {p.machine ? `机械挂机：宿舍减半 +${p.dorm}` : [`宿舍 +${p.dorm}`, p.bestBed && `床位 +${p.bestBed}`, p.idle && `休养 +${p.idle}`, p.unused && `空闲 +${p.unused}`].filter(Boolean).join(' · ')}
              </span>
              <span className="text-emerald-300 tabular-nums">{p.before} → {p.after}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" className="h-9 text-xs" onClick={onCancel}>再想想</Button>
          <Button className="h-9 text-xs" onClick={onConfirm} data-testid="endday-confirm">结束今天</Button>
        </div>
      </div>
    </div>
  )
}
