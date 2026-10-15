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

import { friendlyImageError, imageAuthFailed, markImageAuthFailed, resetImageAuthFailed } from './image-service'

test('生图失败提示：缺 Key / 401 归为鉴权失败，给短提示，不回显原始 JSON', () => {
  const a = friendlyImageError('{"error":"未配置 PixAI API Key"}')
  assert.equal(a.auth, true)
  assert.ok(!a.text.includes('{'))
  assert.equal(friendlyImageError('{"error":"TensorArt 提交失败: 404 {\\"code\\":100001,\\"message\\":\\"unauthorized\\"}"}').auth, true)
  assert.deepEqual(friendlyImageError('Timeout'), { text: 'Timeout', auth: false })
  assert.equal(friendlyImageError(undefined).text, '生成失败')
})

test('鉴权失败后本会话不再自动生图（按服务商记）', () => {
  resetImageAuthFailed()
  assert.equal(imageAuthFailed('pixai'), false)
  markImageAuthFailed('pixai')
  assert.equal(imageAuthFailed('pixai'), true)
  assert.equal(imageAuthFailed('tensorart'), false)
  resetImageAuthFailed()
})
