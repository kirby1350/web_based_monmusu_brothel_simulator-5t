// 第一天新手引导：纯逻辑。进度存在 save.tutorial，可逐步关闭或一键跳过。
import type { GameSave } from './types'

export interface TutorialStep { title: string; body: string }

export const TUTORIAL_STEPS: TutorialStep[] = [
  { title: '欢迎来到你的魔物娘馆', body: '每天有固定的行动次数（顶栏 ⚡）。接客赚金币和声望，调教让她们变强，用完行动就「结束今天」。' },
  { title: '接客', body: '点「接客」挑一位客人和一名魔物娘。对上客人偏好的种族、特质、服装能加分，满意度 70 以上可能变成回头客。' },
  { title: '调教', body: '「调教」消耗一次行动：驯服加服从、放权加淫乱、特训专门练一项技能的熟练度（接客也会慢慢练熟）。熟练度到 25 / 50 / 75 升档，直接抬高接客各步的分数。' },
  { title: '宿舍与体力', body: '接客和调教会消耗体力，体力低于 30 每步都会扣分。晚上在宿舍回复体力，升级宿舍能回得更多、住得更多人。' },
  { title: '准备好了', body: '底部导航：「市场」买人、服装、道具、礼物和调教场景；「设施」升级房间、安排今晚；「经营」定店铺主题、改五步做法。祝生意兴隆！' },
]

export function isTutorialVisible(save: GameSave): boolean {
  return !!save.tutorial && !save.tutorial.dismissed && save.currentDay === 1
}

/** 下一步；最后一步再点即关闭 */
export function advanceTutorial(save: GameSave): GameSave {
  const t = save.tutorial ?? { step: 0, dismissed: false }
  const step = t.step + 1
  return { ...save, tutorial: step >= TUTORIAL_STEPS.length ? { step: t.step, dismissed: true } : { step, dismissed: false } }
}

export function dismissTutorial(save: GameSave): GameSave {
  return { ...save, tutorial: { step: save.tutorial?.step ?? 0, dismissed: true } }
}
