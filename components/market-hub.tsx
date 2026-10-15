'use client'

// 市场页：奴隶市场 / 服装 / 道具 / 礼物 / 调教场景，五个页签
import { Coins, Users } from 'lucide-react'
import { GameSave, AppSettings } from '@/lib/types'
import { MarketScreen } from '@/components/market-screen'
import { ShopPanel } from '@/components/shop-panel'
import { getGirlCapacity } from '@/lib/game-engine'
import { cn } from '@/lib/utils'

export type MarketSub = 'slaves' | 'wardrobe' | 'items' | 'gifts' | 'scenes'
const SUBS: { key: MarketSub; label: string }[] = [
  { key: 'slaves', label: '奴隶市场' }, { key: 'wardrobe', label: '服装' }, { key: 'items', label: '道具' },
  { key: 'gifts', label: '礼物' }, { key: 'scenes', label: '调教场景' },
]

export function MarketHub({ save, settings, sub, onSubChange, onSaveChange, onBuyGirl, onBackToHub }: {
  save: GameSave; settings: AppSettings; sub: MarketSub; onSubChange: (s: MarketSub) => void
  onSaveChange: (s: GameSave) => void; onBuyGirl: (s: GameSave) => void; onBackToHub: () => void
}) {
  const cap = getGirlCapacity(save.player.level ?? 1)
  return (
    <div className="flex flex-col h-full bg-background relative" data-testid="market-hub">
      <header className="border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-bold gold-text">市场</h1>
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1 text-[11px]', save.girls.length >= cap ? 'text-rose-400' : 'text-muted-foreground')}><Users className="w-3.5 h-3.5" />{save.girls.length}/{cap}</span>
          <span className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-amber-400" /><span className="text-xs gold-text font-semibold">{save.player.gold} G</span></span>
        </div>
      </header>
      <div className="border-b border-border px-2 flex shrink-0 overflow-x-auto">
        {SUBS.map((x) => (
          <button key={x.key} data-testid={`market-tab-${x.key}`} onClick={() => onSubChange(x.key)}
            className={cn('px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors',
              sub === x.key ? 'border-amber-400 text-amber-300' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {sub === 'slaves'
          ? <MarketScreen embedded save={save} settings={settings} onSaveChange={onBuyGirl} onBack={onBackToHub} />
          : <div className="flex-1 overflow-y-auto px-4 py-3"><ShopPanel save={save} onSaveChange={onSaveChange} kind={sub} /></div>}
      </div>
    </div>
  )
}
