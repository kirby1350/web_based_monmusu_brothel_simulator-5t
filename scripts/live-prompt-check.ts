// 真模型检查：用夹具拼服务/调教/私聊提示词，经本地 :3001 /api/chat 请求，统计正文字数（不含数据块）
// 用法：tsx scripts/live-prompt-check.ts [service|training|chat|all] [次数]   env CHECK_URL / CHECK_MODEL / CHECK_OUT
import { writeFileSync } from 'node:fs'
import { fxPlayer, fxGirl, fxGuest } from '../lib/prompt-fixtures'
import { buildServiceSystemPrompt, buildInteractionSystemPrompt } from '../lib/prompt-builder'
import { createServiceSession } from '../lib/game-engine'
import { buildStepContext } from '../lib/live-steps'
import { lengthReminder } from '../lib/prompt-context'
import { DEFAULT_SETTINGS } from '../lib/types'

const URL = process.env.CHECK_URL ?? 'http://localhost:3001/api/chat'
const MODEL = process.env.CHECK_MODEL ?? DEFAULT_SETTINGS.chatModel
const which = process.argv[2] ?? 'all'
const N = Number(process.argv[3] ?? 1)
const count = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s/g, '').length

async function ask(system: string, user: string, kind: Parameters<typeof lengthReminder>[0]) {
  const t0 = Date.now()
  const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: user + lengthReminder(kind) }] }) })
  const j = await res.json() as { content?: string; error?: string }
  return { status: res.status, ms: Date.now() - t0, text: j.content ?? `ERROR ${j.error}` }
}

;(async () => {
  const out: string[] = []
  const girl = fxGirl(); const guest = fxGuest()
  const cases: [string, string, string, Parameters<typeof lengthReminder>[0]][] = []
  if (which === 'all' || which === 'service') {
    const s = createServiceSession('service', [girl], { guest })
    const ctx = buildStepContext({ stepLabel: '挑逗', standardAction: '贴耳低语撩拨他', outfitName: '常服 + 黑丝', zoneLabel: '耳朵', zoneLevel: '弱点', plays: [] })
    cases.push(['service', buildServiceSystemPrompt(fxPlayer, s, 'standard', ctx, { day: 6 }), '我让她坐到王老板腿上，贴着他耳朵说话。', 'service'])
  }
  if (which === 'all' || which === 'training') {
    const s = createServiceSession('training', [girl], {})
    cases.push(['training', buildServiceSystemPrompt(fxPlayer, s, 'standard', undefined, { day: 6 }) + '\n\n【本次调教方向】驯服', '命令她跪下，抬起她的下巴。', 'training'])
  }
  if (which === 'all' || which === 'chat') {
    cases.push(['chat', buildInteractionSystemPrompt(fxPlayer, girl, 'chat'), '今天累不累？过来坐我旁边。', 'chat'])
  }
  for (const [name, sys, user, kind] of cases) for (let i = 0; i < N; i++) {
    const r = await ask(sys, user, kind)
    const line = `${name} #${i + 1}: HTTP ${r.status} ${r.ms}ms 正文 ${count(r.text)} 字 | 数据块 ${/<!--STATS:/.test(r.text) ? '有' : '无'}`
    console.log(line); out.push(line, r.text, '')
  }
  if (process.env.CHECK_OUT) writeFileSync(process.env.CHECK_OUT, out.join('\n'))
})()
