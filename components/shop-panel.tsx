'use client'

// 市场里的商品页：服装 / 道具（恢复药、塑形药、调教道具、定制）/ 礼物 / 调教场景
import { useState } from 'react'
import { GameSave } from '@/lib/types'
import { BottomSheet } from '@/components/bottom-sheet'
import { GIFT_OPTIONS, canGiveGiftToday, giveGift } from '@/lib/hub-logic'
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

export type ShopKind = 'wardrobe' | 'items' | 'gifts' | 'scenes'

interface ShopPanelProps {
  save: GameSave
  onSaveChange: (save: GameSave) => void
  kind: ShopKind
}

interface Detail {
  id: string; icon?: string; name: string; desc: string; flavor?: string; price: number
  owned?: string; done?: boolean; locked?: string; onBuy: () => ShopResult
}

/** 市场里的一个商品页：卡片网格，点卡片弹底部抽屉看详情、购买 */
export function ShopPanel({ save, onSaveChange, kind }: ShopPanelProps) {
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { player } = save
  const inv = player.inventory ?? {}
  const wardrobe = new Set(player.wardrobe ?? [])
  const props = new Set(player.ownedTrainingProps ?? [])

  const run = (r: ShopResult) => {
    if (r.ok) onSaveChange(r.save)
    setNotice({ text: r.ok ? r.message : r.error, ok: r.ok })
    setTimeout(() => setNotice(null), 2500)
    return r
  }

  const sections: { title: string; hint: string; items: Detail[] }[] = []
  if (kind === 'wardrobe') {
    sections.push({ title: '衣橱', hint: '买一次全馆可穿；常服自带', items: [...OUTFITS, ...STOCKINGS].filter((o) => o.price > 0).map((o) => ({
      id: o.id, icon: itemIconPath(OUTFITS.some((x) => x.id === o.id) ? 'outfit' : 'stocking', o.id), name: o.name,
      desc: `喜好「${o.pref}」${'effect' in o && o.effect ? ` · ${o.effect}` : ''}`, flavor: o.desc, price: o.price,
      done: wardrobe.has(o.id), onBuy: () => buyWardrobe(save, o.id),
    })) })
  }
  if (kind === 'items') {
    sections.push({ title: '恢复药', hint: '进背包，不占行动，每人每天一瓶；在魔物娘页使用', items: shelfRecoveryItems(save.currentDay).map((i) => ({
      id: i.id, icon: itemIconPath('recovery', i.id), name: i.name, desc: i.stamina === 'full' ? '回满体力并解除疲惫' : `体力 +${i.stamina}`,
      price: i.price, owned: inv[i.id] ? `背包 ${inv[i.id]}` : undefined, onBuy: () => buyRecovery(save, i.id),
    })) })
    sections.push({ title: '塑形药', hint: '进背包，只能在调教里使用；该项每改过一次再贵 80G', items: SCULPT_POTIONS.map((p) => ({
      id: p.id, icon: itemIconPath('sculpt', p.id), name: p.name, desc: `${{ bust: '胸围', waist: '腰围', hip: '臀围' }[p.stat]} ${p.delta > 0 ? '+' : ''}${p.delta}`,
      price: sculptPrice(save, p.stat), owned: inv[p.id] ? `背包 ${inv[p.id]}` : undefined, onBuy: () => buySculpt(save, p.id),
    })) })
    sections.push({ title: '调教道具', hint: '买一次后永久可选', items: TRAINING_PROPS.map((p) => ({
      id: p.id, icon: itemIconPath('prop', p.id), name: p.name, desc: p.zone ? `敏感开发 · ${p.zone}` : '调教加成', price: p.price,
      done: props.has(p.id), onBuy: () => buyTrainingProp(save, p.id),
    })) })
  }
  if (kind === 'scenes') {
    sections.push({ title: '调教场景', hint: `买一次永久可选；每天维护费（当前合计 ${sceneUpkeep(player)}G/天）`, items: TRAINING_SCENES.map((sc) => {
      const owned = (player.ownedScenes ?? []).includes(sc.id)
      return {
        id: `scene-${sc.id}`, name: sc.name, price: sc.price, done: owned,
        locked: !owned && !sceneUnlocked(save, sc.id) ? `需${unlockText(sc.unlock)}` : undefined,
        desc: `${sc.directions.map((d) => DIRECTION_LABEL[d]).join('/')} · 维护 ${sc.upkeep}G/天 · 可觉醒「${sc.fetish}」`,
        flavor: `${sc.effect}${sc.affinity.length ? `｜亲和：${sc.affinity.join('、')}` : ''}${sc.aversion.length ? `｜抗拒：${sc.aversion.join('、')}` : ''}`,
        onBuy: () => buyScene(save, sc.id),
      }
    }) })
  }
  const all = sections.flatMap((x) => x.items)
  const detail = all.find((d) => d.id === detailId) ?? null
  const can = detail && !detail.done && !detail.locked && player.gold >= detail.price

  return (
    <div className="space-y-4" data-testid={`shop-${kind}`}>
      {notice && (
        <div className={cn('rounded-lg border px-3 py-1.5 text-xs', notice.ok ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-rose-500/10 border-rose-500/30 text-rose-300')} data-testid="shop-notice">{notice.text}</div>
      )}
      {kind === 'gifts' && <GiftShop save={save} onSaveChange={onSaveChange} notify={(text, ok) => { setNotice({ text, ok }); setTimeout(() => setNotice(null), 2500) }} />}
      {sections.map((sec) => (
        <Section key={sec.title} title={sec.title} hint={sec.hint}>
          {sec.items.map((d) => <Item key={d.id} d={d} gold={player.gold} onOpen={() => setDetailId(d.id)} />)}
        </Section>
      ))}
      {kind === 'items' && <CustomPropForm save={save} onResult={run} />}

      <BottomSheet open={!!detail} onClose={() => setDetailId(null)} testId="shop-sheet"
        title={detail && <span className="flex items-center gap-2"><ItemIcon src={detail.icon} name={detail.name} size={28} />{detail.name}</span>}>
        {detail && (
          <>
            <p className="text-xs text-foreground/85">{detail.desc}</p>
            {detail.flavor && <p className="text-[11px] text-rose-200/70 leading-relaxed whitespace-pre-line">{detail.flavor.replace(/｜/g, '\n')}</p>}
            {detail.owned && <p className="text-[11px] text-emerald-300">{detail.owned}</p>}
            {detail.locked && <p className="text-[11px] text-rose-300">{detail.locked}</p>}
            <button data-testid={`buy-${detail.id}`} disabled={!can}
              onClick={() => run(detail.onBuy())}
              className={cn('w-full text-xs rounded-lg border px-2 py-2 transition-colors',
                detail.done ? 'border-emerald-500/30 text-emerald-300/80 cursor-default'
                  : can ? 'border-amber-400/50 text-amber-400 hover:bg-amber-400/10' : 'border-border text-muted-foreground/60 cursor-not-allowed')}>
              {detail.done ? '已拥有' : detail.locked ? `${detail.price} G · 未解锁` : player.gold < detail.price ? `${detail.price} G（还差 ${detail.price - player.gold}G）` : `购买 ${detail.price} G`}
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  )
}

/** 礼物：选礼物和对象，全馆每天一次 */
function GiftShop({ save, onSaveChange, notify }: { save: GameSave; onSaveChange: (s: GameSave) => void; notify: (t: string, ok: boolean) => void }) {
  const [gift, setGift] = useState<number | null>(null)
  const today = canGiveGiftToday(save)
  return (
    <>
      <Section title="礼物" hint={today ? '全馆每天送一次；也可以在魔物娘页里送' : '今天已经送过礼了'}>
        {GIFT_OPTIONS.map((g, i) => (
          <button key={g.name} data-testid={`gift-${i}`} onClick={() => setGift(i)}
            className="rounded-lg border border-border bg-card px-2.5 py-2 text-left space-y-0.5 hover:border-amber-400/40">
            <p className="text-xs">{g.name}</p>
            <p className="text-[10px] text-muted-foreground">好感约 +{g.affectionBonus}（看喜好、同礼递减）</p>
            <p className="text-[11px] text-amber-400">{g.cost} G</p>
          </button>
        ))}
      </Section>
      <BottomSheet open={gift !== null} onClose={() => setGift(null)} title={gift !== null ? `送「${GIFT_OPTIONS[gift].name}」给谁？` : ''} testId="gift-sheet">
        {!today && <p className="text-[11px] text-rose-300">今天已经送过礼了（全馆每天一次）</p>}
        <div className="grid grid-cols-2 gap-1.5">
          {save.girls.map((g) => (
            <button key={g.id} data-testid={`gift-to-${g.name}`} disabled={!today || gift === null || save.player.gold < GIFT_OPTIONS[gift].cost}
              onClick={() => {
                if (gift === null) return
                const r = giveGift(save, g.id, gift)
                if (r.ok) { onSaveChange(r.save); notify(r.message ?? `送给了${g.name}`, true); setGift(null) } else notify(r.error, false)
              }}
              className="rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-xs text-left disabled:opacity-40 hover:border-amber-400/40">
              <span className="gold-text">{g.name}</span> <span className="text-[10px] text-muted-foreground">好感 {g.affection}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
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

function Item({ d, gold, onOpen }: { d: Detail; gold: number; onOpen: () => void }) {
  const can = !d.done && !d.locked && gold >= d.price
  return (
    <button onClick={onOpen} data-testid={`item-${d.id}`}
      className="rounded-lg border border-border bg-card px-2.5 py-2 flex flex-col gap-1 text-left hover:border-amber-400/40 transition-colors">
      <div className="flex items-start gap-2 flex-1 w-full">
        <ItemIcon src={d.icon} name={d.name} size={32} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs">{d.name}</span>
            {d.owned && <span className="text-[10px] text-emerald-300">{d.owned}</span>}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-2">{d.desc}</p>
        </div>
      </div>
      <span className={cn('text-[11px]', d.done ? 'text-emerald-300/80' : d.locked ? 'text-muted-foreground/60' : can ? 'text-amber-400' : 'text-muted-foreground/60')}>
        {d.done ? '已拥有' : d.locked ? `${d.price} G · ${d.locked}` : `${d.price} G`}
      </span>
    </button>
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
