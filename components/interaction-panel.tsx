'use client'

import { useState } from 'react'
import { Gift, MessageCircle, X, Heart, Loader2 } from 'lucide-react'
import { MonstGirl, Player, ChatMessage, AppSettings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatBar } from '@/components/stat-bar'
import { ImageDisplay } from '@/components/image-display'
import { ChatEngine } from '@/components/chat-engine'
import { buildInteractionSystemPrompt, buildOpeningDialoguePrompt } from '@/lib/prompt-builder'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { GIFT_OPTIONS } from '@/lib/hub-logic'
import { recordQuote } from '@/lib/girl-memory'

interface InteractionPanelProps {
  girl: MonstGirl
  player: Player
  settings: AppSettings
  onClose: () => void
  onGirlUpdated: (updated: MonstGirl) => void
  /** 送礼走大厅的 giveGift（全馆每天一次、当场扣钱），由魔物娘页传入 */
  onGift: (giftIndex: number) => string | null
  giftBlockedReason?: string
  /** 当前天数（「让她记住」记在哪一天） */
  day?: number
}

type InteractionType = 'chat' | 'gift'


export function InteractionPanel({ girl, player, settings, onClose, onGirlUpdated, onGift, giftBlockedReason, day }: InteractionPanelProps) {
  const [started, setStarted] = useState(false)
  const [mode, setMode] = useState<InteractionType>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [openingLoading, setOpeningLoading] = useState(false)
  const [giftFeedback, setGiftFeedback] = useState('')
  const [imageUrl, setImageUrl] = useState(girl.imageUrl)

  // Called when user clicks "开始互动" — sends the opening greeting with streaming
  const handleStart = async () => {
    setStarted(true)
    const apiKey = settings.chatModel.startsWith('grok') ? settings.grokApiKey : settings.chatApiKey
    const fallback = `……（${girl.name} 看了看你，${girl.affection >= 50 ? '露出了微笑' : '保持着沉默'}）`
    if (!apiKey) {
      setMessages([{ role: 'assistant', content: fallback }])
      return
    }
    setOpeningLoading(true)
    setMessages([{ role: 'assistant', content: '' }]) // placeholder for streaming
    const prompt = buildOpeningDialoguePrompt('interaction', player, [girl], { girl })
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: settings.chatModel, apiKey, stream: true }),
      })
      if (!res.ok || !res.body) throw new Error('API error')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              full += delta
              setMessages([{ role: 'assistant', content: full }])
            } catch { /* skip */ }
          }
        }
      }
      if (!full.trim()) setMessages([{ role: 'assistant', content: fallback }])
    } catch {
      setMessages([{ role: 'assistant', content: fallback }])
    } finally {
      setOpeningLoading(false)
    }
  }

  const systemPrompt = buildInteractionSystemPrompt(player, girl, mode)

  const handleGift = (index: number) => {
    const msg = onGift(index)
    if (msg) {
      setGiftFeedback(msg)
      setTimeout(() => setGiftFeedback(''), 3000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden dungeon-border">

        {/* Header — always visible */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold gold-text">{girl.name}</h2>
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{girl.race}</Badge>
          </div>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Pre-start screen: girl profile + start button */}
        {!started ? (
          <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Left: portrait */}
            <div className="w-full sm:w-44 shrink-0 p-3 border-b sm:border-b-0 sm:border-r border-border">
              <ImageDisplay
                tags={girl.imageTags}
                settings={settings}
                cachedUrl={imageUrl}
                onUrlCached={(url) => { setImageUrl(url); onGirlUpdated({ ...girl, imageUrl: url }) }}
                alt={girl.name}
                className="w-full"
              />
            </div>
            {/* Right: stats, personality, backstory, start button */}
            <div className="flex-1 p-5 flex flex-col gap-4 justify-between min-h-0 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">属性</p>
                  <div className="space-y-2">
                    <StatBar label="好感度" value={girl.affection} color="pink" size="sm" />
                    <StatBar label="服从度" value={girl.obedience} color="blue" size="sm" />
                    <StatBar label="淫乱度" value={girl.lewdness} color="rose" size="sm" />
                  </div>
                </div>
                {girl.personality && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">性格</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{girl.personality}</p>
                  </div>
                )}
                {girl.otherDesc && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">背景</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{girl.otherDesc}</p>
                  </div>
                )}
              </div>
              <Button className="w-full h-10 glow-btn" onClick={handleStart}>
                <Heart className="w-4 h-4 mr-2" />
                开始与 {girl.name} 互动
              </Button>
            </div>
          </div>
        ) : (
          /* Active interaction screen */
          <div className="flex flex-1 min-h-0">
            {/* Sidebar: image + stats */}
            <div className="w-44 border-r border-border p-3 space-y-3 flex-shrink-0 overflow-y-auto">
              <ImageDisplay
                tags={girl.imageTags}
                settings={settings}
                cachedUrl={imageUrl}
                onUrlCached={(url) => { setImageUrl(url); onGirlUpdated({ ...girl, imageUrl: url }) }}
                alt={girl.name}
                className="w-full"
              />
              <div className="space-y-1.5">
                <StatBar label="好感度" value={girl.affection} color="pink" size="sm" />
                <StatBar label="服从度" value={girl.obedience} color="blue" size="sm" />
                <StatBar label="淫乱度" value={girl.lewdness} color="rose" size="sm" />
              </div>
              {openingLoading && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>准备中…</span>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground leading-relaxed">{girl.personality}</p>
            </div>

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mode tabs */}
              <div className="flex border-b border-border shrink-0">
                {([
                  { key: 'chat', label: '闲聊', icon: MessageCircle },
                  { key: 'gift', label: '送礼', icon: Gift },
                ] as { key: InteractionType; label: string; icon: typeof MessageCircle }[]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2.5 text-xs border-b-2 transition-colors',
                      mode === key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setMode(key)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Chat mode */}
              {mode === 'chat' && (
                openingLoading ? (
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{girl.name} 正在思考开场白…</span>
                  </div>
                ) : (
                  <ChatEngine
                    systemPrompt={systemPrompt}
                    messages={messages}
                    onMessagesChange={setMessages}
                    settings={settings}
                    className="flex-1 min-h-0"
                    placeholder={`和 ${girl.name} 说点什么…`}
                    onRememberUser={(t) => onGirlUpdated(recordQuote(girl, t, day ?? player.day))}
                  />
                )
              )}

              {/* Gift mode */}
              {mode === 'gift' && (
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                  <p className="text-xs text-muted-foreground">
                    当前金币：<span className="gold-text font-semibold">{player.gold} G</span>
                  </p>
                  {giftBlockedReason && <p className="text-[11px] text-rose-400/80">{giftBlockedReason}</p>}
                  {giftFeedback && (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-primary">
                      {giftFeedback}
                    </div>
                  )}
                  <div className="space-y-2">
                    {GIFT_OPTIONS.map((g, i) => (
                      <div key={g.name} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
                        <div>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-[10px] text-muted-foreground">好感度 +{g.affectionBonus}</p>
                        </div>
                        <Button size="sm" className="h-7 text-xs" disabled={!!giftBlockedReason || player.gold < g.cost} onClick={() => handleGift(i)}>
                          {g.cost} G
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
