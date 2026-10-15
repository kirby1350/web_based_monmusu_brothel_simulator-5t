// 亲自上场 vs 跳过：满意度示例表（改动前公式 / 改动后公式）。用法：tsx scripts/live-sat-table.ts
import { fxGirl, fxGuest } from '../lib/prompt-fixtures'
import { resolveService, getMainService } from '../lib/resolve-service'
import { initLiveState, recordTurn, nextStep, resolveLiveSteps, recordModelStats, liveStepScore, topicHit } from '../lib/live-steps'
import { STEP_STANDARD_ACTION } from '../lib/live-steps'
import type { MonstGirl, Guest, OutfitId, StockingId } from '../lib/types'

export interface Case { name: string; girl: MonstGirl; guest: Guest; outfit: OutfitId; stockings: StockingId; plays: string[]; roomLevel: number }
export const CASES: Case[] = [
  { name: '新人（狐娘·初学口侍，常服无 play，口侍客）', girl: fxGirl({ lewdness: 35, obedience: 30 }), guest: fxGuest({ desires: '想被痴女主动求欢', prefOutfit: undefined, prefRace: undefined }), outfit: 'regular', stockings: 'none', plays: [], roomLevel: 1 },
  { name: '中期（熟练口侍、初学待客/手技，黑丝对口，1 play）', girl: fxGirl({ skillRanks: { 待客: '初学', 口侍: '熟练', 手技: '初学' }, proficiency: { 待客: 30, 口侍: 55, 手技: 30 }, lewdness: 45, obedience: 45 }),
    guest: fxGuest({ desires: '想被痴女主动求欢', prefOutfit: '黑丝', prefRace: undefined }), outfit: 'regular', stockings: 'black', plays: ['lewd_dance'], roomLevel: 2 },
  { name: '后期（熟练三项，服装不对口，2 play，挑剔客 −8）', girl: fxGirl({ skillRanks: { 待客: '熟练', 口侍: '熟练', 手技: '熟练' }, proficiency: { 待客: 55, 口侍: 60, 手技: 55 }, lewdness: 60, obedience: 60 }),
    guest: fxGuest({ desires: '想被痴女主动求欢', prefOutfit: '制服', prefRace: undefined, demand: 8 }), outfit: 'regular', stockings: 'none', plays: ['lewd_dance', 'long_massage'], roomLevel: 3 },
]

type Style = { label: string; per: number; text: (step: number) => string; model: number }
export const STYLES: Style[] = [
  { label: '敷衍：每步 1 条「继续」', per: 1, text: () => '继续', model: 4 },
  { label: '每步 1 条普通话', per: 1, text: () => '她看着客人笑了笑，开始动作', model: 8 },
  { label: '每步 1 条对口', per: 1, text: (i) => STEP_STANDARD_ACTION[i] + '，照着客人的喜好来', model: 10 },
  { label: '投入：每步 3 条对口', per: 3, text: (i) => STEP_STANDARD_ACTION[i] + '，照着客人的喜好来', model: 12 },
]

export function runLive(c: Case, st: Style) {
  const plan = { girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, plays: c.plays, roomLevel: c.roomLevel }
  let s = initLiveState(plan)
  const main = getMainService(c.guest)
  for (let i = 0; i < 5; i++) {
    for (let t = 0; t < st.per; t++) {
      const text = st.text(i)
      const topic = topicHit(text, { desires: c.guest.desires, stepIndex: i, stepAction: STEP_STANDARD_ACTION[i], mainSkill: main })
      s = recordTurn(s, { text, topic, heat: { guest: c.guest, girls: [c.girl], mainSkill: main, zone: undefined, outfit: c.outfit, stockings: c.stockings } })
      s = recordModelStats(s, st.model)
    }
    s = nextStep(s)
  }
  return resolveLiveSteps(plan, s)
}

/** 改动前：每步 base + (回合−1)×2，play 只算场内插入（准备页选的不算），无匹配加成 */
export function oldLive(c: Case, per: number) {
  const r = resolveService({ girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, plays: [], roomLevel: c.roomLevel, skip: false })
  return Math.max(0, Math.min(100, r.steps.reduce((a, x) => a + liveStepScore(x.score, per, true), 0) + r.playScore + r.satisfactionBonus))
}

if (require.main === module) {
  for (const c of CASES) {
    const skip = resolveService({ girl: c.girl, guest: c.guest, outfit: c.outfit, stockings: c.stockings, plays: c.plays, roomLevel: c.roomLevel, skip: true })
    console.log(`\n### ${c.name}\n跳过：${skip.satisfaction}（匹配 +${skip.matchBonus}）`)
    console.log('| 打法 | 改前 | 改后 | 改后明细 |\n|---|---|---|---|')
    for (const st of STYLES) {
      const r = runLive(c, st)
      console.log(`| ${st.label}（模型每回合 +${st.model}） | ${oldLive(c, st.per)} | **${r.satisfaction}** | 步骤 ${r.standardScore} + play ${r.playScore} + 加成 ${r.satisfactionBonus} + 匹配 ${r.live.liveMatch} + 模型 ${r.live.model} + 高潮 ${r.live.heat} |`)
    }
  }
}
