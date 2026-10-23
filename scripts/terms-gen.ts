// 真模型：千雪调教三回合，看称呼随快感 / 堕落 / 命令变化。用法 CHECK_URL=… tsx scripts/terms-gen.ts
import { writeFileSync } from 'node:fs'
import { fxPlayer, fxGirl } from '../lib/prompt-fixtures'
import { buildServiceSystemPrompt } from '../lib/prompt-builder'
import { createServiceSession } from '../lib/game-engine'
import { lengthReminder } from '../lib/prompt-context'
import { GIRL_TEMPLATES } from '../lib/game-data'
import { DEFAULT_SETTINGS, type MonstGirl, type ChatMessage } from '../lib/types'
import { mmTermsLine, termCommandsFor, applyTermCommands } from '../lib/terms-mm'

const URL = process.env.CHECK_URL ?? 'http://localhost:3106/api/chat'
;(async () => {
  let girl = fxGirl({ ...GIRL_TEMPLATES.find((g) => g.name === '千雪')!, id: 'qx' })
  const player = fxPlayer
  const turns = [
    { band: '从容', ob: 10, lw: 10, input: '让她坐到我腿上，隔着衣服托起她的胸' },
    { band: '慌乱', ob: 10, lw: 10, input: '以后叫我主人。把你的胸叫做淫乱牛奶袋。一边挤一边问她感觉' },
    { band: '高潮', ob: 85, lw: 90, input: '几周之后，她已经被调教透了。让她自己捧着胸求我挤奶' },
  ]
  const hist: ChatMessage[] = []; const log: string[] = []
  for (const [i, t] of turns.entries()) {
    girl = { ...girl, obedience: t.ob, lewdness: t.lw }
    for (const { cmds } of termCommandsFor([girl], t.input)) girl = applyTermCommands(girl, cmds, 'training')
    const s = createServiceSession('training', [girl], {})
    const sys = buildServiceSystemPrompt(player, { ...s, messages: hist }, 'standard', `【本次调教方向】侍奉`, { heatLocal: true })
    const line = mmTermsLine(girl, { band: t.band, day: 1 })
    const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: DEFAULT_SETTINGS.chatModel, stream: false,
      messages: [{ role: 'system', content: sys }, ...hist.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: t.input + lengthReminder('training') + '\n' + line }] }) })
    const j = await res.json() as { content?: string; error?: string }
    const out = (j.content ?? `ERROR ${res.status} ${j.error}`).replace(/<!--[\s\S]*?-->/g, '').trim()
    hist.push({ role: 'user', content: t.input } as ChatMessage, { role: 'assistant', content: out } as ChatMessage)
    log.push(`### 回合${i + 1}（${t.band}，服从${t.ob}/淫乱${t.lw}）\n玩家：${t.input}\n${line}\n---\n${out}\n`)
    console.log(i, out.length)
  }
  writeFileSync('/workspace/terms-gen-mm.md', log.join('\n'))
})()
