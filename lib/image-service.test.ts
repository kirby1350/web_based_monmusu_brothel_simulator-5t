import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tensorArtImageUrl } from './image-service'

test('TensorArt 结果解析：优先 successInfo.images，兜底 job.images', () => {
  // 2026-10 实际返回格式
  assert.equal(tensorArtImageUrl({ status: 'SUCCESS', successInfo: { images: [{ id: 'a', url: 'https://r2/a.png' }, { url: 'https://r2/b.png' }] } }), 'https://r2/a.png')
  // 旧格式
  assert.equal(tensorArtImageUrl({ status: 'SUCCESS', images: [{ url: 'https://old/x.png' }] }), 'https://old/x.png')
  // 两者都有时以 successInfo 为准；successInfo 为空则用 images
  assert.equal(tensorArtImageUrl({ successInfo: { images: [{ url: 'new' }] }, images: [{ url: 'old' }] }), 'new')
  assert.equal(tensorArtImageUrl({ successInfo: { images: [] }, images: [{ url: 'old' }] }), 'old')
  // 进行中 / 异常输入
  assert.equal(tensorArtImageUrl({ status: 'RUNNING' }), undefined)
  assert.equal(tensorArtImageUrl({ successInfo: { images: [{ url: '' }, { url: 42 }] } }), undefined)
  assert.equal(tensorArtImageUrl(null), undefined)
  assert.equal(tensorArtImageUrl(undefined), undefined)
})
