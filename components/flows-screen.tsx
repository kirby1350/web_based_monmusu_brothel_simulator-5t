'use client'

// 流程页（第 5 点）：默认流程常驻可编辑 · 流程模板（≤5，设为默认/复制/删除）· 魔物娘专属做法
// 做法只进亲自上场的推荐和提示词，不影响计分；偏好 play 只在准备页预选
import { useState } from 'react'
import { Plus, Star, Copy, Trash2, Pencil } from 'lucide-react'
import { GameSave, MonstGirl, ServiceFlow } from '@/lib/types'
import { StepActionsEditor } from '@/components/step-actions-editor'
import { BottomSheet } from '@/components/bottom-sheet'
import { GirlThumb } from '@/components/girl-thumb'
import { getStepActions } from '@/lib/custom-props'
import { SERVICE_STEPS } from '@/lib/resolve-service'
import { STEP_STANDARD_ACTION } from '@/lib/live-steps'
import { PLAYS, STEP_ACTION_MAX } from '@/lib/catalog'
import { getFlows, getDefaultFlow, saveFlow, duplicateFlow, deleteFlow, setDefaultFlow, hasGirlFlow, MAX_FLOWS, FLOW_NAME_MAX, type FlowResult } from '@/lib/service-flows'
import { cn } from '@/lib/utils'

const newId = () => `flow_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function FlowsScreen({ save, onSaveChange }: { save: GameSave; onSaveChange: (s: GameSave) => void }) {
  const { player, girls } = save
  const [notice, setNotice] = useState<{ t: string; ok: boolean } | null>(null)
  const [editing, setEditing] = useState<ServiceFlow | 'new' | null>(null)
  const [girlId, setGirlId] = useState<string | null>(null)
  const flows = getFlows(player)
  const def = getDefaultFlow(player)
  const run = (r: FlowResult) => {
    if (r.ok) onSaveChange(r.save)
    setNotice({ t: r.ok ? r.message : r.error, ok: r.ok }); setTimeout(() => setNotice(null), 2500)
    return r.ok
  }
  const openGirl = girls.find((g) => g.id === girlId) ?? null

  return (
    <div className="flex flex-col h-full bg-background relative" data-testid="flows">
      <header className="border-b border-border px-4 py-2.5 shrink-0">
        <h1 className="text-sm font-bold gold-text">服务流程</h1>
        <p className="text-[10px] text-muted-foreground">五步做法只改叙述和亲自上场的推荐，不影响计分</p>
      </header>
      {notice && <div className={cn('mx-4 mt-2 rounded-lg border px-3 py-1.5 text-xs', notice.ok ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-rose-500/10 border-rose-500/30 text-rose-300')} data-testid="notice">{notice.t}</div>}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 默认流程：常驻展开 */}
        {def && (
          <section className="rounded-xl border border-amber-400/30 bg-card p-3 space-y-2" data-testid="flow-default">
            <p className="text-xs font-semibold gold-text flex items-center gap-1.5"><Star className="w-3.5 h-3.5" />默认流程 · {def.name}</p>
            <FlowForm key={def.id + JSON.stringify(def.actions)} flow={def} testId="flow-default-form" compact
              onSave={(f) => run(saveFlow(save, f, newId))} />
          </section>
        )}

        {/* 模板列表 */}
        <section className="space-y-1.5" data-testid="flow-list">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold gold-text">流程模板 <span className="text-[10px] text-muted-foreground font-normal">{flows.length}/{MAX_FLOWS}</span></p>
            <button data-testid="flow-new" disabled={flows.length >= MAX_FLOWS} onClick={() => setEditing('new')}
              className="text-[11px] text-amber-400 flex items-center gap-0.5 disabled:text-muted-foreground/50"><Plus className="w-3 h-3" />新建</button>
          </div>
          {flows.map((f) => {
            const acts = STEP_STANDARD_ACTION.map((d, i) => f.actions[i]?.trim() || d)
            const isDef = f.id === player.defaultFlowId
            return (
              <div key={f.id} className={cn('rounded-lg border bg-card px-3 py-2 space-y-1', isDef ? 'border-amber-400/40' : 'border-border')} data-testid={`flow-${f.name}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{f.name}</span>
                  {isDef && <span className="text-[9px] rounded bg-amber-400/15 text-amber-300 px-1">默认</span>}
                  <span className="flex-1" />
                  <IconBtn icon={Pencil} label="编辑" onClick={() => setEditing(f)} testId={`flow-edit-${f.name}`} />
                  {!isDef && <IconBtn icon={Star} label="设为默认" onClick={() => run(setDefaultFlow(save, f.id))} testId={`flow-default-${f.name}`} />}
                  <IconBtn icon={Copy} label="复制" disabled={flows.length >= MAX_FLOWS} onClick={() => run(duplicateFlow(save, f.id, newId))} testId={`flow-copy-${f.name}`} />
                  <IconBtn icon={Trash2} label="删除" disabled={flows.length <= 1} onClick={() => run(deleteFlow(save, f.id))} testId={`flow-delete-${f.name}`} />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{acts.join(' → ')}</p>
                {!!f.plays?.length && <p className="text-[10px] text-pink-300/80">偏好 play：{f.plays.map((p) => `${SERVICE_STEPS[p.step]?.label}·${PLAYS.find((x) => x.id === p.playId)?.name ?? p.playId}`).join('、')}</p>}
              </div>
            )
          })}
        </section>

        {/* 专属做法 */}
        <section className="space-y-1.5" data-testid="flow-girls">
          <p className="text-xs font-semibold gold-text">魔物娘专属做法</p>
          <p className="text-[10px] text-muted-foreground">设了专属做法的人，接客时默认用她自己的（准备页可以改选模板）。</p>
          {girls.map((g) => (
            <button key={g.id} onClick={() => setGirlId(g.id)} data-testid={`flow-girl-${g.name}`}
              className="w-full flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left hover:border-amber-400/40">
              <GirlThumb g={g} />
              <div className="min-w-0 flex-1">
                <p className="text-xs gold-text">{g.name} <span className={cn('text-[9px] ml-1', hasGirlFlow(g) ? 'text-pink-300' : 'text-muted-foreground')}>{hasGirlFlow(g) ? '专属' : '用默认'}</span></p>
                <p className="text-[10px] text-muted-foreground truncate">{getStepActions(player, g).join(' → ')}</p>
              </div>
            </button>
          ))}
        </section>
      </div>

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} testId="flow-sheet" title={editing === 'new' ? '新建流程' : editing ? `编辑「${editing.name}」` : ''}>
        {editing && (
          <FlowForm flow={editing === 'new' ? undefined : editing} testId="flow-form" withPlays
            onSave={(f) => { if (run(saveFlow(save, f, newId))) setEditing(null) }} />
        )}
      </BottomSheet>
      <BottomSheet open={!!openGirl} onClose={() => setGirlId(null)} testId="flow-girl-sheet" title={openGirl ? `${openGirl.name}的专属做法` : ''}>
        {openGirl && <GirlFlowEditor girl={openGirl} save={save} onSaveChange={onSaveChange} />}
      </BottomSheet>
    </div>
  )
}

function GirlFlowEditor({ girl, save, onSaveChange }: { girl: MonstGirl; save: GameSave; onSaveChange: (s: GameSave) => void }) {
  return (
    <StepActionsEditor title="标准做法（只对她）" testId="girl-step-actions" value={girl.stepActions} placeholders={getStepActions(save.player)} defaultOpen
      onSave={(v) => onSaveChange({ ...save, girls: save.girls.map((g) => (g.id === girl.id ? { ...g, stepActions: v } : g)) })} />
  )
}

function IconBtn({ icon: Icon, label, onClick, disabled, testId }: { icon: typeof Star; label: string; onClick: () => void; disabled?: boolean; testId: string }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} disabled={disabled} data-testid={testId}
      className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-amber-300 hover:border-amber-400/40 disabled:opacity-30">
      <Icon className="w-3 h-3" />
    </button>
  )
}

/** 名字 + 五步 + （可选）偏好 play，最多 3 个 */
function FlowForm({ flow, onSave, testId, withPlays, compact }: {
  flow?: ServiceFlow; onSave: (f: { id?: string; name: string; actions: string[]; plays?: { step: number; playId: string }[] }) => void
  testId: string; withPlays?: boolean; compact?: boolean
}) {
  const [name, setName] = useState(flow?.name ?? '')
  const [acts, setActs] = useState<string[]>(() => STEP_STANDARD_ACTION.map((_, i) => flow?.actions[i] ?? ''))
  const [plays, setPlays] = useState<{ step: number; playId: string }[]>(flow?.plays ?? [])
  return (
    <div className="space-y-1.5" data-testid={testId}>
      {!compact && (
        <input value={name} maxLength={FLOW_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={`流程名（≤${FLOW_NAME_MAX} 字，如「温柔路线」）`} data-testid={`${testId}-name`}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
      )}
      {SERVICE_STEPS.map((s, i) => (
        <label key={s.key} className="flex items-center gap-2">
          <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{s.label}</span>
          <input value={acts[i]} maxLength={STEP_ACTION_MAX} placeholder={STEP_STANDARD_ACTION[i]} data-testid={`${testId}-${i}`}
            onChange={(e) => setActs((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
            className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-[11px]" />
        </label>
      ))}
      {withPlays && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">偏好 play（准备页自动预选，槽数仍看服务房间；最多 3 个）</p>
          {plays.map((p, k) => (
            <div key={k} className="flex gap-1.5">
              <select value={p.step} onChange={(e) => setPlays((ps) => ps.map((x, j) => (j === k ? { ...x, step: Number(e.target.value) } : x)))}
                className="rounded-md border border-border bg-background px-1 py-0.5 text-[11px]">
                {SERVICE_STEPS.map((s, i) => <option key={s.key} value={i}>{s.label}</option>)}
              </select>
              <select value={p.playId} onChange={(e) => setPlays((ps) => ps.map((x, j) => (j === k ? { ...x, playId: e.target.value } : x)))}
                className="flex-1 rounded-md border border-border bg-background px-1 py-0.5 text-[11px]">
                {PLAYS.map((x) => <option key={x.id} value={x.id}>{x.name}（{x.source}）</option>)}
              </select>
              <button className="text-[11px] text-rose-300 px-1" onClick={() => setPlays((ps) => ps.filter((_, j) => j !== k))}>×</button>
            </div>
          ))}
          {plays.length < 3 && <button className="text-[11px] text-amber-400" data-testid={`${testId}-addplay`} onClick={() => setPlays((ps) => [...ps, { step: 3, playId: PLAYS[0].id }])}>+ 偏好 play</button>}
        </div>
      )}
      <button data-testid={`${testId}-save`} onClick={() => onSave({ id: flow?.id, name: compact ? (flow?.name ?? '标准') : name, actions: acts, plays: withPlays ? plays : flow?.plays })}
        className="w-full text-[11px] rounded-md border border-amber-400/40 px-2 py-1 text-amber-400 hover:bg-amber-400/10">保存</button>
    </div>
  )
}
