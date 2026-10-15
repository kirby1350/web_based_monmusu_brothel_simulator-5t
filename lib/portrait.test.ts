import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { portraitSrc, portraitSrcSet, hasPortraitVariants } from './portrait'
import { PORTRAIT_VARIANT_SOURCES } from './portrait-manifest'
import { GIRL_TEMPLATE_IMAGES } from './game-data'

test('立绘尺寸：本地预设走 webp 变体，full 用原图', () => {
  assert.equal(portraitSrc('/presets/narumeiya.jpg', 'sm'), '/presets/sizes/narumeiya-sm.webp')
  assert.equal(portraitSrc('/presets/narumeiya.jpg', 'md'), '/presets/sizes/narumeiya-md.webp')
  assert.equal(portraitSrc('/presets/narumeiya.jpg', 'full'), '/presets/narumeiya.jpg')
  assert.match(portraitSrcSet('/presets/qianxue.jpg')!, /qianxue-sm\.webp 160w, .*qianxue-md\.webp 480w, \/presets\/qianxue\.jpg 1152w/)
})

test('立绘尺寸：AI/远程/未登记的图原样返回，没有 srcSet', () => {
  for (const u of ['https://r2.example/x.png?sig=1', 'data:image/png;base64,AAA', '/presets/unknown.jpg']) {
    assert.equal(portraitSrc(u, 'sm'), u)
    assert.equal(portraitSrc(u, 'md'), u)
    assert.equal(portraitSrcSet(u), undefined)
  }
  assert.equal(portraitSrc(undefined, 'md'), undefined)
  assert.equal(hasPortraitVariants(''), false)
})

test('立绘尺寸：每张预设立绘都已登记且变体文件存在（新增立绘后需重跑 scripts/portrait-sizes.py）', () => {
  for (const u of GIRL_TEMPLATE_IMAGES.filter(Boolean) as string[]) assert.ok(PORTRAIT_VARIANT_SOURCES.includes(u), u)
  for (const u of PORTRAIT_VARIANT_SOURCES) {
    for (const s of ['sm', 'md'] as const) assert.ok(existsSync(join(process.cwd(), 'public', portraitSrc(u, s))), `${u} ${s}`)
  }
})
