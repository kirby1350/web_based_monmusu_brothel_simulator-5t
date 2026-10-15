// 客人主需求改写（客人生成的偏向/主题/保底共用）
import type { Guest } from './types'
import { GUEST_DESIRES } from './game-engine'
import { getDesireProfile } from './catalog'

type Main = '口侍' | '胸侍' | '身侍'
export const pickR = <T,>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)]
export const desiresFor = (svc: Main | null, kind?: 'M' | 'S' | '中性') => GUEST_DESIRES.filter((d) => {
  const p = getDesireProfile(d)
  const main = p.service === '口侍' || p.service === '胸侍' ? p.service : '身侍'
  return (!svc || main === svc) && (!kind || p.kind === kind)
})
/** 换掉客人的主需求（连同判定标签），可指定主类型 / M·S */
export function withDesire(g: Guest, svc: Main | null, kind: 'M' | 'S' | '中性' | undefined, rng: () => number): Guest {
  const pool = desiresFor(svc, kind).length ? desiresFor(svc, kind) : desiresFor(svc).length ? desiresFor(svc) : GUEST_DESIRES
  const desires = pickR(pool, rng)
  const p = getDesireProfile(desires)
  return { ...g, desires, desireKind: p.kind, desireService: p.service, desireDetail: undefined }
}
