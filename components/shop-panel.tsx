'use client'

// 商店：恢复药 / 塑形药 / 衣橱 / 调教道具（作为大厅「商店」页，市场旁边的一页，不新开路由）
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { GameSave } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { OUTFITS, STOCKINGS, SCULPT_POTIONS, TRAINING_PROPS, itemIconPath } from '@/lib/catalog'
import { ItemIcon } from '@/components/item-icon'
import {
  shelfRecoveryItems, sculptPrice, buyRecovery, buySculpt, buyWardrobe, buyTrainingProp, type ShopResult,
} from '@/lib/shop'
import { cn } from '@/lib/utils'

interface ShopPanelProps {
  save: GameSave
  onSaveChange: (save: GameSave) => void
  onOpenMarket: () => void
}

export function ShopPanel({ save, onSaveChange, onOpenMarket }: ShopPanelProps) {
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)
  const { player } = save
  const inv = player.inventory ?? {}
  const wardrobe = new Set(player.wardrobe ?? [])
  const props = new Set(player.ownedTrainingProps ?? [])

  const run = (r: ShopResult) => {
    if (r.ok) onSaveChange(r.save)
    setNotice({ text: r.ok ? r.message : r.error, ok: r.ok })
    setTimeout(() => setNotice(null), 2500)
  }

  return (
    <div className="space-y-4" data-testid="shop">
      {notice && (
        <div className={cn('rounded-lg border px-3 py-1.5 text-xs', notice.ok ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-rose-500/10 border-rose-500/30 text-rose-300')}>{notice.text}</div>
      )}

      <Section title="恢复药" hint="进背包，不占行动，每人每天一瓶；在魔物娘页使用">
        {shelfRecoveryItems(save.currentDay).map((i) => (
          <Item key={i.id} icon={itemIconPath('recovery', i.id)} name={i.name} desc={i.stamina === 'full' ? '回满体力并解除疲惫' : `体力 +${i.stamina}`}
            price={i.price} gold={player.gold} owned={inv[i.id] ? `背包 ${inv[i.id]}` : undefined}
            onBuy={() => run(buyRecovery(save, i.id))} testId={`buy-${i.id}`} />
        ))}
      </Section>

      <Section title="衣橱" hint="买一次全馆可穿；常服自带">
        {[...OUTFITS, ...STOCKINGS].filter((o) => o.price > 0).map((o) => (
          <Item key={o.id} icon={itemIconPath(OUTFITS.some((x) => x.id === o.id) ? 'outfit' : 'stocking', o.id)} name={o.name} desc={`喜好「${o.pref}」`} price={o.price} gold={player.gold}
            done={wardrobe.has(o.id)} onBuy={() => run(buyWardrobe(save, o.id))} testId={`buy-${o.id}`} />
        ))}
      </Section>

      <Section title="塑形药" hint="进背包，只能在调教里使用；该项每改过一次再贵 80G">
        {SCULPT_POTIONS.map((p) => (
          <Item key={p.id} icon={itemIconPath('sculpt', p.id)} name={p.name} desc={`${{ bust: '胸围', waist: '腰围', hip: '臀围' }[p.stat]} ${p.delta > 0 ? '+' : ''}${p.delta}`}
            price={sculptPrice(save, p.stat)} gold={player.gold} owned={inv[p.id] ? `背包 ${inv[p.id]}` : undefined}
            onBuy={() => run(buySculpt(save, p.id))} testId={`buy-${p.id}`} />
        ))}
      </Section>

      <Section title="调教道具" hint="买一次后永久可选">
        {TRAINING_PROPS.map((p) => (
          <Item key={p.id} icon={itemIconPath('prop', p.id)} name={p.name} desc={p.zone ? `敏感开发 · ${p.zone}` : '调教加成'} price={p.price} gold={player.gold}
            done={props.has(p.id)} onBuy={() => run(buyTrainingProp(save, p.id))} testId={`buy-${p.id}`} />
        ))}
      </Section>

      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={onOpenMarket}>
        <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />前往奴隶市场
      </Button>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold gold-text">{title}</p>
        <p className="text-[10px] text-muted-foreground text-right">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </section>
  )
}

function Item({ icon, name, desc, price, gold, owned, done, onBuy, testId }: {
  icon?: string; name: string; desc: string; price: number; gold: number; owned?: string; done?: boolean; onBuy: () => void; testId: string
}) {
  const can = !done && gold >= price
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 flex flex-col gap-1">
      <div className="flex items-start gap-2 flex-1">
        <ItemIcon src={icon} name={name} size={32} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs">{name}</span>
            {owned && <span className="text-[10px] text-emerald-300">{owned}</span>}
          </div>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button data-testid={testId} disabled={!can} onClick={onBuy}
        className={cn('text-[11px] rounded-md border px-2 py-0.5 transition-colors',
          done ? 'border-emerald-500/30 text-emerald-300/80 cursor-default'
            : can ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/60 cursor-not-allowed')}>
        {done ? '已拥有' : `${price} G`}
      </button>
    </div>
  )
}
