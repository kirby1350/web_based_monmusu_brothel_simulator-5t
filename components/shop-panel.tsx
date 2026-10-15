'use client'

// 商店：恢复药 / 塑形药 / 衣橱 / 调教道具（作为大厅「商店」页，市场旁边的一页，不新开路由）
import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { GameSave } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { OUTFITS, STOCKINGS, SCULPT_POTIONS, TRAINING_PROPS, itemIconPath } from '@/lib/catalog'
import { ItemIcon } from '@/components/item-icon'
import { CUSTOM_PROP_TEMPLATES, MAX_CUSTOM_PROPS, CUSTOM_PROP_NAME_MAX, CUSTOM_PROP_DESC_MAX } from '@/lib/catalog'
import { createCustomProp, customPropPrice, getTemplate } from '@/lib/custom-props'
import {
  shelfRecoveryItems, sculptPrice, buyRecovery, buySculpt, buyWardrobe, buyTrainingProp, type ShopResult,
} from '@/lib/shop'
import { cn } from '@/lib/utils'
import { TRAINING_SCENES, sceneUnlocked, sceneUpkeep, unlockText, DIRECTION_LABEL } from '@/lib/scenes'
import { buyScene } from '@/lib/shop'

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
          <Item key={o.id} icon={itemIconPath(OUTFITS.some((x) => x.id === o.id) ? 'outfit' : 'stocking', o.id)} name={o.name} desc={`喜好「${o.pref}」${'effect' in o && o.effect ? ` · ${o.effect}` : ''}`} flavor={o.desc} price={o.price} gold={player.gold}
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

      <Section title="调教场景" hint={`买一次永久可选；每天维护费（当前合计 ${sceneUpkeep(player)}G/天）`}>
        {TRAINING_SCENES.map((sc) => {
          const owned = (player.ownedScenes ?? []).includes(sc.id)
          const unlocked = sceneUnlocked(save, sc.id)
          return (
            <Item key={sc.id} name={sc.name}
              desc={`${sc.directions.map((d) => DIRECTION_LABEL[d]).join('/')} · 维护 ${sc.upkeep}G/天 · 可觉醒「${sc.fetish}」`}
              flavor={`${sc.effect}${sc.affinity.length ? `｜亲和：${sc.affinity.join('、')}` : ''}${sc.aversion.length ? `｜抗拒：${sc.aversion.join('、')}` : ''}`}
              price={sc.price} gold={player.gold} done={owned} locked={!owned && !unlocked ? `需${unlockText(sc.unlock)}` : undefined}
              onBuy={() => run(buyScene(save, sc.id))} testId={`buy-scene-${sc.id}`} />
          )
        })}
      </Section>

      <CustomPropForm save={save} onResult={run} />

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

function Item({ icon, name, desc, flavor, price, gold, owned, done, locked, onBuy, testId }: {
  icon?: string; name: string; desc: string; flavor?: string; price: number; gold: number; owned?: string; done?: boolean; locked?: string; onBuy: () => void; testId: string
}) {
  const can = !done && !locked && gold >= price
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
          {flavor && <p className="text-[10px] text-rose-200/60 leading-snug line-clamp-2" title={flavor}>{flavor}</p>}
        </div>
      </div>
      <button data-testid={testId} disabled={!can} onClick={onBuy}
        className={cn('text-[11px] rounded-md border px-2 py-0.5 transition-colors',
          done ? 'border-emerald-500/30 text-emerald-300/80 cursor-default'
            : can ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/60 cursor-not-allowed')}>
        {done ? '已拥有' : locked ? `${price} G · ${locked}` : `${price} G`}
      </button>
    </div>
  )
}

/** 「定制」：名字 + 描述 + 效果模板，预览价格 */
function CustomPropForm({ save, onResult }: { save: GameSave; onResult: (r: ShopResult) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tpl, setTpl] = useState(CUSTOM_PROP_TEMPLATES[0].id)
  const list = save.player.customProps ?? []
  const price = customPropPrice(tpl) ?? 0
  const full = list.length >= MAX_CUSTOM_PROPS
  const submit = () => {
    const r = createCustomProp(save, { name, desc, templateId: tpl })
    onResult(r)
    if (r.ok) { setName(''); setDesc('') }
  }
  return (
    <section className="space-y-1.5" data-testid="custom-props">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold gold-text">定制调教道具 <span className="text-[10px] text-muted-foreground font-normal">{list.length}/{MAX_CUSTOM_PROPS}</span></p>
        <button className="text-[10px] text-amber-400 underline" onClick={() => setOpen(!open)} data-testid="custom-toggle">{open ? '收起' : '定制'}</button>
      </div>
      {list.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
          <ItemIcon src={`/icons/prop/${getTemplate(c.templateId)?.baseProp}.webp`} name={c.name} size={24} />
          <div className="min-w-0">
            <p className="text-xs">{c.name} <span className="text-[9px] text-emerald-300">定制</span></p>
            <p className="text-[10px] text-muted-foreground truncate">{getTemplate(c.templateId)?.label}{c.desc ? ` · ${c.desc}` : ''}</p>
          </div>
        </div>
      ))}
      {open && (
        <div className="rounded-lg border border-amber-400/30 bg-card p-2.5 space-y-1.5">
          <input data-testid="custom-name" value={name} maxLength={CUSTOM_PROP_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={`名字（≤${CUSTOM_PROP_NAME_MAX} 字）`}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <input data-testid="custom-desc" value={desc} maxLength={CUSTOM_PROP_DESC_MAX} onChange={(e) => setDesc(e.target.value)} placeholder={`描述（可空，≤${CUSTOM_PROP_DESC_MAX} 字）`}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <select data-testid="custom-template" value={tpl} onChange={(e) => setTpl(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[11px]">
            {CUSTOM_PROP_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label} · {customPropPrice(t.id)}G</option>)}
          </select>
          <button data-testid="custom-buy" disabled={full || !name.trim() || save.player.gold < price} onClick={submit}
            className={cn('w-full text-[11px] rounded-md border px-2 py-1',
              !full && name.trim() && save.player.gold >= price ? 'border-amber-400/40 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/60 cursor-not-allowed')}>
            {full ? `已达上限 ${MAX_CUSTOM_PROPS} 件` : save.player.gold < price ? `${price} G（还差 ${price - save.player.gold}G）` : `定制 ${price} G`}
          </button>
        </div>
      )}
    </section>
  )
}
