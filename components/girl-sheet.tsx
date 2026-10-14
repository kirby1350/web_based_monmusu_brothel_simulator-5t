'use client'

import { useState } from 'react'
import { X, Gift, MessageCircle, Sparkles } from 'lucide-react'
import { GameSave, MonstGirl, AppSettings, SensitivityZone } from '@/lib/types'
import { ImageDisplay } from '@/components/image-display'
import { InteractionPanel } from '@/components/interaction-panel'
import { StatBar } from '@/components/stat-bar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GIFT_OPTIONS, canGiveGiftToday, giveGift, pendingSkillPicks } from '@/lib/hub-logic'
import { COMMON_ZONES, RACE_ZONE_NAMES, RACE_TRAITS, getSensitivityLevel } from '@/lib/catalog'
import { SkillPicker } from '@/components/skill-picker'
import { useRecovery } from '@/lib/shop'
import { RECOVERY_ITEMS } from '@/lib/catalog'
import { cn } from '@/lib/utils'

interface GirlSheetProps {
  girl: MonstGirl
  save: GameSave
  settings: AppSettings
  onSaveChange: (save: GameSave) => void
  onClose: () => void
}

const LEVEL_COLOR: Record<string, string> = {
  迟钝: 'text-muted-foreground', 普通: 'text-foreground/80', 敏感: 'text-pink-300', 弱点: 'text-rose-400',
}

export function GirlSheet({ girl, save, settings, onSaveChange, onClose }: GirlSheetProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [outfit, setOutfit] = useState(girl.outfit)
  const [outfitTags, setOutfitTags] = useState(girl.outfitTags)
  const { player } = save
  const stamina = girl.stamina ?? 100
  const giftToday = canGiveGiftToday(save)
  const giftBlockedReason = giftToday ? undefined : '今天已经送过礼了（全馆每天一次）'

  const updateGirl = (g: MonstGirl) => onSaveChange({ ...save, girls: save.girls.map((x) => (x.id === g.id ? g : x)) })

  const doGift = (i: number): string | null => {
    const r = giveGift(save, girl.id, i)
    if (!r.ok) { setFeedback(r.error); return r.error }
    onSaveChange(r.save)
    setFeedback(r.message)
    return r.message
  }

  const saveOutfit = () => {
    updateGirl({
      ...girl, outfit, outfitTags,
      imageTags: girl.imageTags.replace(girl.outfitTags, outfitTags),
      imageUrl: outfitTags !== girl.outfitTags ? undefined : girl.imageUrl,
    })
    setFeedback('常服描述已保存')
  }

  const bodyTraits = [
    (girl.bust ?? 0) >= 95 && '巨乳',
    (girl.bust ?? 0) > 0 && (girl.bust ?? 0) <= 82 && '贫乳',
    (girl.hip ?? 0) >= 95 && '丰臀',
    (girl.waist ?? 99) <= 60 && '细腰',
  ].filter(Boolean) as string[]

  const zones: { key: SensitivityZone; label: string }[] = [
    ...COMMON_ZONES.map((z) => ({ key: z, label: z })),
    ...(RACE_ZONE_NAMES[girl.race] ? [{ key: '种族' as SensitivityZone, label: `${RACE_ZONE_NAMES[girl.race]}（种族）` }] : []),
  ]

  return (
    <div className="absolute inset-0 z-40 bg-background flex flex-col" data-testid="girl-sheet">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold gold-text">{girl.name}</h2>
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{girl.race}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose} aria-label="关闭">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-4 mt-2 shrink-0">
          <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
          <TabsTrigger value="body" className="text-xs">身体</TabsTrigger>
          <TabsTrigger value="skills" className="text-xs">
            技能{pendingSkillPicks(girl) > 0 && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
          </TabsTrigger>
          <TabsTrigger value="sens" className="text-xs">敏感带</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {feedback && (
            <div className="mb-3 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-xs text-primary">{feedback}</div>
          )}

          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="flex gap-3">
              <div className="w-28 shrink-0 rounded-lg overflow-hidden">
                <ImageDisplay tags={girl.imageTags} settings={settings} cachedUrl={girl.imageUrl}
                  onUrlCached={(url) => updateGirl({ ...girl, imageUrl: url })} alt={girl.name} className="w-full" />
              </div>
              <div className="flex-1 space-y-2">
                <StatBar label="好感" value={girl.affection} color="pink" size="sm" />
                <StatBar label="服从" value={girl.obedience} color="blue" size="sm" />
                <StatBar label="淫乱" value={girl.lewdness} color="rose" size="sm" />
                <StatBar label="体力" value={stamina} color="green" size="sm" />
                {girl.exhausted && <Badge variant="secondary" className="text-[9px] bg-rose-500/15 text-rose-300">疲惫</Badge>}
                {RACE_TRAITS[girl.race] && (
                  <p className="text-[10px] text-muted-foreground">种族特技：<span className="text-amber-300">{RACE_TRAITS[girl.race]}</span>{RACE_ZONE_NAMES[girl.race] && <> · 签名敏感带：<span className="text-pink-300">{RACE_ZONE_NAMES[girl.race]}</span></>}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Gift className="w-3 h-3" />送礼</p>
                <span className="text-[10px] text-muted-foreground">金币 <span className="gold-text">{player.gold} G</span></span>
              </div>
              {giftBlockedReason && <p className="text-[11px] text-rose-400/80 mb-1.5">{giftBlockedReason}</p>}
              <div className="grid grid-cols-3 gap-2">
                {GIFT_OPTIONS.map((g, i) => (
                  <button key={g.name} data-testid={`gift-${i}`}
                    disabled={!giftToday || player.gold < g.cost}
                    onClick={() => doGift(i)}
                    className={cn('rounded-lg border border-border bg-secondary/30 px-2 py-2 text-left transition-colors hover:border-primary/50',
                      (!giftToday || player.gold < g.cost) && 'opacity-40 pointer-events-none')}>
                    <p className="text-xs font-medium">{g.name}</p>
                    <p className="text-[10px] text-muted-foreground">{g.cost}G · 好感 +{g.affectionBonus}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">背包 · 恢复药（每人每天一瓶）</p>
              {RECOVERY_ITEMS.filter((i) => (player.inventory?.[i.id] ?? 0) > 0).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">背包里没有恢复药，可以在大厅「商店」购买。</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {RECOVERY_ITEMS.filter((i) => (player.inventory?.[i.id] ?? 0) > 0).map((i) => (
                    <button key={i.id} data-testid={`use-${i.id}`} disabled={girl.itemUsedOnDay === save.currentDay}
                      onClick={() => { const r = useRecovery(save, girl.id, i.id); if (r.ok) onSaveChange(r.save); setFeedback(r.ok ? r.message : r.error) }}
                      className={cn('rounded-md border border-border px-2 py-1 text-[11px] hover:border-emerald-400/60', girl.itemUsedOnDay === save.currentDay && 'opacity-40 pointer-events-none')}>
                      {i.name} ×{player.inventory?.[i.id]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button variant="secondary" className="w-full h-9 text-xs" onClick={() => setChatOpen(true)}>
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" />闲聊
            </Button>

            {girl.personality && <p className="text-xs text-foreground/70 leading-relaxed">{girl.personality}</p>}
          </TabsContent>

          <TabsContent value="body" className="space-y-4 mt-0">
            <div className="grid grid-cols-3 gap-2 text-center">
              {([['胸围', girl.bust], ['腰围', girl.waist], ['臀围', girl.hip]] as const).map(([l, v]) => (
                <div key={l} className="rounded-lg border border-border bg-secondary/30 py-2">
                  <p className="text-[10px] text-muted-foreground">{l}</p>
                  <p className="text-sm font-mono gold-text">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {bodyTraits.length === 0 ? <span className="text-[11px] text-muted-foreground">无明显体型特征</span> :
                bodyTraits.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>
            {girl.bodyDesc && <p className="text-xs text-foreground/70 leading-relaxed">{girl.bodyDesc}</p>}
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">常服</p>
              <Label className="text-xs text-muted-foreground">服装描述</Label>
              <Input value={outfit} onChange={(e) => setOutfit(e.target.value)} className="bg-input text-sm h-9" />
              <Label className="text-xs text-muted-foreground">服装 TAG（英文，用于生图）</Label>
              <Input value={outfitTags} onChange={(e) => setOutfitTags(e.target.value)} className="bg-input text-xs font-mono h-9" />
              <Button size="sm" className="w-full h-8 text-xs" onClick={saveOutfit} disabled={!outfit.trim()}>保存常服</Button>
            </div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4 mt-0">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">服侍技能（最多 3 个）</p>
              {Object.keys(girl.skillRanks ?? {}).length === 0 ? (
                <p className="text-[11px] text-muted-foreground">还没有选择技能。服从 30、淫乱 40、好感 50 时各可选一次。</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(girl.skillRanks ?? {}).map(([k, rank]) => (
                    <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-1.5">
                      <span className="text-xs">{k}</span>
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-300">{rank}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {pendingSkillPicks(girl) > 0 && (
              <SkillPicker girl={girl} onPicked={(g) => { updateGirl(g); setFeedback(`${g.name} 学会了新技能`) }} />
            )}
            {girl.skills.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">旧技能（不参与新结算）</p>
                <div className="flex flex-wrap gap-1">
                  {girl.skills.map((s) => <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>)}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sens" className="space-y-1.5 mt-0">
            {zones.map(({ key, label }) => {
              const v = girl.sensitivities?.[key] ?? 30
              const lv = getSensitivityLevel(v)
              return (
                <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-1.5">
                  <span className="text-xs w-24 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-pink-400/70" style={{ width: `${v}%` }} />
                  </div>
                  <span className={cn('text-[10px] w-14 text-right', LEVEL_COLOR[lv])}>{lv} {v}</span>
                </div>
              )
            })}
            <p className="text-[10px] text-muted-foreground pt-1"><Sparkles className="w-3 h-3 inline mr-1" />敏感开发在调教里进行。</p>
          </TabsContent>
        </div>
      </Tabs>

      {chatOpen && (
        <InteractionPanel
          girl={girl}
          player={player}
          settings={settings}
          onClose={() => setChatOpen(false)}
          onGirlUpdated={updateGirl}
          onGift={doGift}
          giftBlockedReason={giftBlockedReason}
        />
      )}
    </div>
  )
}
