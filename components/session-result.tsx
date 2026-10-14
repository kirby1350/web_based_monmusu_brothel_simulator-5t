'use client'

// 结算卡：五步得分 / play / 服装 / 体力 / 成长，没有 play 时不画空段
import { useState } from 'react'
import { Loader2, Star, PenLine, Brush } from 'lucide-react'
import { ImageDisplay } from '@/components/image-display'
import { AppSettings, Guest, MonstGirl, OutfitId, StockingId } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { OUTFITS, STOCKINGS } from '@/lib/catalog'
import type { ServiceResult } from '@/lib/resolve-service'
import type { SettleInfo } from '@/lib/settle-session'
import { cn } from '@/lib/utils'

interface SessionResultProps {
  mode: 'skip' | 'live'
  girl: MonstGirl
  guest: Guest
  outfit: OutfitId
  stockings: StockingId
  result: ServiceResult
  info: SettleInfo
  settings: AppSettings
  onBack: () => void
}

export function SessionResult({ mode, girl, guest, outfit, stockings, result, info, settings, onBack }: SessionResultProps) {
  const [extra, setExtra] = useState('')
  const [loading, setLoading] = useState(false)
  const [redraw, setRedraw] = useState(false)
  const outfitDef = OUTFITS.find((o) => o.id === outfit)
  const stockingDef = STOCKINGS.find((x) => x.id === stockings)
  const newOutfitTags = [outfitDef?.tags, stockingDef?.tags].filter(Boolean).join(', ')
  // 只有换了衣橱里的衣服才有新标签可重绘（常服用她自己的标签）
  const redrawTags = newOutfitTags
    ? (girl.outfitTags && girl.imageTags.includes(girl.outfitTags) ? girl.imageTags.replace(girl.outfitTags, newOutfitTags) : `${girl.imageTags}, ${newOutfitTags}`)
    : ''

  // 「补一段」：可选地调用现有 /api/chat 生成一段长文
  const writeMore = async () => {
    setLoading(true)
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const prompt = `用中文写一段约200字的第三人称叙事，描写魔物娘${girl.name}（${girl.race}，性格：${girl.personality}）接待客人${guest.name}（${guest.race}，需求：${guest.desires}）的经过。` +
      `流程依次是：${result.steps.map((s) => s.label).join('、')}${result.plays.length ? `，中间追加了${result.plays.map((p) => p.name).join('、')}` : ''}。` +
      `她穿着${OUTFITS.find((o) => o.id === outfit)?.name}。客人最终评价为「${result.tier.label}」。只输出正文，不要输出任何数据块。`
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: false }),
      })
      const text = res.ok ? ((await res.json()).content ?? '').trim() : ''
      setExtra(text || '（生成失败，请检查设置中的对话 API Key）')
    } catch {
      setExtra('（生成失败，请检查设置中的对话 API Key）')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="session-result">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold gold-text">{mode === 'skip' ? '跳过结算' : '服务结束'}</h2>
        <p className="text-xs text-muted-foreground">{result.summary}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
        <div className="flex justify-between items-baseline">
          <span className="text-muted-foreground">满意度</span>
          <span className="text-sm font-semibold text-amber-400" data-testid="result-satisfaction">{result.satisfaction} / 100（{result.tier.label}）</span>
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">收入</span><span className="gold-text font-semibold" data-testid="result-gold">+{info.reward} G</span></div>
        {info.reputationDelta !== 0 && (
          <div className="flex justify-between"><span className="text-muted-foreground">声望</span>
            <span className={info.reputationDelta > 0 ? 'text-pink-300' : 'text-rose-400'}>{info.reputationDelta > 0 ? '+' : ''}{info.reputationDelta}</span></div>
        )}
        {info.becameRegular && <p className="flex items-center gap-1 text-emerald-400"><Star className="w-3.5 h-3.5" />「{guest.name}」成为了回头客</p>}

        <Section title={`五步得分 ${result.standardScore} / 70`}>
          {result.steps.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-10 text-muted-foreground">{s.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-amber-400/80" style={{ width: `${(s.score / 14) * 100}%` }} /></div>
              <span className="w-6 text-right tabular-nums">{s.score}</span>
            </div>
          ))}
        </Section>

        {result.plays.length > 0 && (
          <Section title={`追加 play ${result.playScore > 0 ? '+' : ''}${result.playScore}`}>
            {result.plays.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span>{p.name} <span className="text-muted-foreground text-[10px]">{p.rank}{p.matched ? ' · 对口' : ''}</span></span>
                <span className={cn('tabular-nums', p.score < 0 ? 'text-rose-400' : 'gold-text')}>{p.score > 0 ? '+' : ''}{p.score}</span>
              </div>
            ))}
          </Section>
        )}

        <Section title="服装">
          <p>{OUTFITS.find((o) => o.id === outfit)?.name}{stockings !== 'none' ? ` + ${STOCKINGS.find((s) => s.id === stockings)?.name}` : ''}
            {guest.prefOutfit ? (result.outfitMatched ? <span className="text-emerald-300">（对上「{guest.prefOutfit}」）</span> : <span className="text-muted-foreground">（客人想要「{guest.prefOutfit}」）</span>) : null}</p>
        </Section>

        {redrawTags && (
          <div className="pt-1">
            {redraw ? (
              <ImageDisplay tags={redrawTags} settings={settings} alt={girl.name} autoGenerate className="w-32 mx-auto" />
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setRedraw(true)}>
                <Brush className="w-3 h-3 mr-1" />按新标签重绘（可选，不重绘也已结算）
              </Button>
            )}
          </div>
        )}

        <Section title="体力">
          <p data-testid="result-stamina">{girl.name}：{info.staminaBefore} → {info.staminaAfter}（−{result.staminaCost}）</p>
        </Section>

        {result.affectionDelta > 0 && (
          <Section title="成长"><p>好感 +{result.affectionDelta}</p></Section>
        )}
      </div>

      {extra ? (
        <div className="rounded-xl border border-border bg-secondary/20 p-3 text-sm leading-relaxed whitespace-pre-wrap">{extra}</div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-9 text-xs" onClick={writeMore} disabled={loading}>
          {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />生成中…</> : <><PenLine className="w-3.5 h-3.5 mr-1.5" />补一段</>}
        </Button>
      )}
      <Button className="w-full h-10 glow-btn" onClick={onBack} data-testid="btn-back-hub">返回大厅</Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-2 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}
