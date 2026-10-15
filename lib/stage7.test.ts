import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GameSave } from './types'
import { OUTFITS, STOCKINGS, RECOVERY_ITEMS, SCULPT_POTIONS, TRAINING_PROPS, itemIconPath } from './catalog'
import { bannerPath, shortfallText, upgradeChangeText, setBestBed, nightlyRecovery } from './hub-logic'

const pub = (p: string) => join(process.cwd(), 'public', p)

test('每个道具都有图标文件（常服/无丝袜除外的规则一致）', () => {
  const all: [Parameters<typeof itemIconPath>[0], string][] = [
    ...OUTFITS.map((o) => ['outfit', o.id] as const), ...STOCKINGS.filter((s) => s.id !== 'none').map((s) => ['stocking', s.id] as const),
    ...RECOVERY_ITEMS.map((i) => ['recovery', i.id] as const), ...SCULPT_POTIONS.map((i) => ['sculpt', i.id] as const),
    ...TRAINING_PROPS.map((i) => ['prop', i.id] as const),
  ].map(([c, id]) => [c, id])
  assert.equal(all.length, 44) // 18 衣服 + 5 丝袜 + 3 恢复 + 6 塑形 + 12 道具
  for (const [c, id] of all) assert.ok(existsSync(pub(itemIconPath(c, id)!)), `${c}/${id}`)
  assert.equal(itemIconPath('stocking', 'none'), undefined)
})

test('设施横幅 4×4 都在；等级夹在 1–4', () => {
  for (const f of ['brothel', 'dorm', 'service', 'training'] as const)
    for (let lv = 1; lv <= 4; lv++) assert.ok(existsSync(pub(bannerPath(f, lv))), `${f}-${lv}`)
  assert.equal(bannerPath('brothel', 7), '/banners/brothel-4.webp')
  assert.equal(bannerPath('dorm', undefined), '/banners/dorm-1.webp')
})

test('升级反馈文字：差额、变化、满级', () => {
  assert.equal(shortfallText(500, 180), '还差 320G')
  assert.equal(shortfallText(500, 500), '')
  assert.equal(shortfallText(null, 0), '')
  assert.equal(upgradeChangeText('service', 1, 2), '服务房间 Lv.2：额外 play 槽 0 → 1')
  assert.match(upgradeChangeText('training', 1, 2), /道具槽 0 → 1/)
  assert.match(upgradeChangeText('dorm', 3, 4), /可指定床位/)
})

test('指定床位：单间才能设；夜间恢复多 +15', () => {
  const g = { id: 'a', name: 'A', stamina: 0 } as GameSave['girls'][number]
  const base = { player: { dormLevel: 3 }, girls: [g] } as unknown as GameSave
  assert.equal(setBestBed(base, 'a').ok, false)
  const lv4 = { ...base, player: { dormLevel: 4 } } as unknown as GameSave
  const r = setBestBed(lv4, 'a'); assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.save.bestBedGirlId, 'a')
    assert.equal(nightlyRecovery(r.save, g) - nightlyRecovery(lv4, g), 15)
    const off = setBestBed(r.save, null); assert.ok(off.ok); if (off.ok) assert.equal(off.save.bestBedGirlId, undefined)
  }
  assert.equal(setBestBed(lv4, 'zz').ok, false)
})

test('play 图标：未就绪时返回 undefined（组件显示文字徽章）；就绪集合里的都有文件', async () => {
  const { ALL_PLAYS, PLAY_ICONS_READY, playIconPath } = await import('./catalog')
  for (const p of ALL_PLAYS) {
    const src = playIconPath(p.id)
    if (PLAY_ICONS_READY.has(p.id)) assert.ok(existsSync(pub(src!)), p.id)
    else assert.equal(src, undefined)
  }
})

test('30 条 play 图标全部就绪且有文件', async () => {
  const { ALL_PLAYS, PLAY_ICONS_READY } = await import('./catalog')
  // 体质 play（trait_*）的图标还没画：卡片退回文字徽章
  const drawn = ALL_PLAYS.filter((p) => p.source !== 'trait')
  assert.equal(drawn.length, 30)
  for (const p of drawn) assert.ok(PLAY_ICONS_READY.has(p.id), p.id)
  for (const id of PLAY_ICONS_READY) assert.ok(ALL_PLAYS.some((p) => p.id === id), `stray ${id}`)
})
