'use client'

import { useState, useEffect, useCallback } from 'react'
import { Key, Bot, Palette, ChevronDown, ChevronUp, Check, RefreshCw, Loader2 } from 'lucide-react'
import {
  AppSettings,
  CHAT_MODELS,
  IMAGE_MODELS,
  IMAGE_STYLES,
  TENSORART_MODELS,
  PROSE_STYLE_LABELS,
  ImageStyle,
  ImageModel,
  TensorArtModel,
  ImageProvider,
  ProseStyle,
  DzmmModel,
} from '@/lib/types'
import { saveSettings } from '@/lib/storage'
import { cn } from '@/lib/utils'

type ChatModelInfo = (typeof CHAT_MODELS)[number]

const DZMM_GROUP = '在线模型（实时获取）'
const GROK_MODELS = CHAT_MODELS.filter((m) => m.provider === 'grok')
const STATIC_DEFAULT_MODELS = CHAT_MODELS.filter((m) => m.provider === 'default')

interface SettingsPanelProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
      {children}
    </h2>
  )
}

function FieldLabel({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </label>
  )
}

function ApiKeyInput({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  hint,
  badge,
}: {
  label: string
  icon: React.ElementType
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
  badge?: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
        {badge}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs pr-10 focus:outline-none focus:border-primary transition-colors font-mono"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? '隐藏' : '显示'}
        >
          {show ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground/50 mt-1">{hint}</p>}
    </div>
  )
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings })
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'image'>('chat')
  const [dzmmModels, setDzmmModels] = useState<DzmmModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')

  const update = (patch: Partial<AppSettings>) => {
    setLocal((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  const fetchModels = useCallback(async (apiKey: string) => {
    setModelsLoading(true)
    setModelsError('')
    try {
      const res = await fetch('/api/models', {
        headers: apiKey ? { 'x-api-key': apiKey } : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '获取失败')
      const list: DzmmModel[] = Array.isArray(data?.data) ? data.data : []
      setDzmmModels(list)
    } catch (e) {
      setModelsError(String(e instanceof Error ? e.message : e))
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // 面板打开时拉取一次实时模型列表
  useEffect(() => {
    fetchModels(local.chatApiKey || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 实时模型列表（拉取失败时回退到内置列表），始终追加 Grok
  const chatModels: ChatModelInfo[] = [
    ...(dzmmModels.length > 0
      ? dzmmModels.map((m) => ({
          value: m.id,
          label: m.context_window ? `${m.name} · ${Math.round(m.context_window / 1000)}K` : m.name,
          group: DZMM_GROUP,
          provider: 'default' as const,
        }))
      : STATIC_DEFAULT_MODELS),
    ...GROK_MODELS,
  ]

  const handleSave = () => {
    saveSettings(local)
    onSettingsChange(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { key: 'chat', label: '文字模型', icon: Bot },
          { key: 'image', label: '图片模型', icon: Palette },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'chat' | 'image')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors -mb-px',
              activeTab === key
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {activeTab === 'chat' ? (
          <>
            <section>
              <SectionTitle>API 密钥</SectionTitle>
              <div className="space-y-4">
                {/* Chat API Key */}
                <div>
                  <FieldLabel icon={Key}>Chat API Key</FieldLabel>
                  <div className="relative">
                    <input
                      type="password"
                      value={local.chatApiKey}
                      onChange={(e) => update({ chatApiKey: e.target.value })}
                      placeholder="留空则使用服务器环境变量"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    用于 gpt4novel API，可在此覆盖服务器端 Key
                  </p>
                </div>

                {/* Grok API Key */}
                <div>
                  <FieldLabel icon={Key}>
                    Grok API Key
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                      xAI
                    </span>
                  </FieldLabel>
                  <input
                    type="password"
                    value={local.grokApiKey ?? ''}
                    onChange={(e) => update({ grokApiKey: e.target.value })}
                    placeholder="选择 Grok 系列模型时使用"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    仅在选择下方 Grok 系列模型时生效
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle>对话模型</SectionTitle>
                <button
                  onClick={() => fetchModels(local.chatApiKey || '')}
                  disabled={modelsLoading}
                  title="刷新模型列表"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors -mt-2"
                >
                  {modelsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  刷新
                </button>
              </div>
              {modelsError && (
                <p className="text-[10px] text-rose-400/80 mb-2">
                  模型列表获取失败（已回退到内置列表）：{modelsError}
                </p>
              )}
              <div className="space-y-4">
                {(() => {
                  const groups: Record<string, ChatModelInfo[]> = {}
                  chatModels.forEach((m) => {
                    if (!groups[m.group]) groups[m.group] = []
                    groups[m.group].push(m)
                  })
                  return Object.entries(groups).map(([groupName, models]) => (
                    <div key={groupName}>
                      <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-2">
                        {groupName}
                      </div>
                      <div className="space-y-1.5">
                        {models.map((m) => {
                          const active = local.chatModel === m.value
                          return (
                            <button
                              key={m.value}
                              onClick={() => update({ chatModel: m.value })}
                              className={cn(
                                'w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex items-center justify-between',
                                active
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
                              )}
                            >
                              <span>{m.label}</span>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </section>

            <section>
              <SectionTitle>叙事文风</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROSE_STYLE_LABELS) as ProseStyle[]).map((key) => {
                  const active = (local.proseStyle ?? 'standard') === key
                  return (
                    <button
                      key={key}
                      onClick={() => update({ proseStyle: key })}
                      title={PROSE_STYLE_LABELS[key].hint}
                      className={cn(
                        'px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {PROSE_STYLE_LABELS[key].label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-1.5">
                {PROSE_STYLE_LABELS[local.proseStyle ?? 'standard'].hint}；去油约束始终生效
              </p>
            </section>
          </>
        ) : (
          <>
            <section>
              <SectionTitle>图片生成服务</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'pixai', label: 'PixAI' },
                    { key: 'tensorart', label: 'TensorArt' },
                  ] as { key: ImageProvider; label: string }[]
                ).map(({ key, label }) => {
                  const active = (local.imageProvider ?? 'pixai') === key
                  return (
                    <button
                      key={key}
                      onClick={() => update({ imageProvider: key })}
                      className={cn(
                        'px-3 py-2.5 rounded-lg border text-sm font-medium transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </section>

            {(local.imageProvider ?? 'pixai') === 'pixai' ? (
              <>
                <section>
                  <SectionTitle>PixAI 配置</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel icon={Key}>PixAI API Key</FieldLabel>
                      <input
                        type="password"
                        value={local.pixaiApiKey}
                        onChange={(e) => update({ pixaiApiKey: e.target.value })}
                        placeholder="留空则使用服务器环境变量"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors font-mono"
                      />
                    </div>
                    <div>
                      <FieldLabel>PixAI 模型</FieldLabel>
                      <div className="space-y-1.5">
                        {(Object.keys(IMAGE_MODELS) as ImageModel[]).map((key) => {
                          const active = local.imageModel === key
                          return (
                            <button
                              key={key}
                              onClick={() => update({ imageModel: key })}
                              className={cn(
                                'w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all flex items-center justify-between',
                                active
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
                              )}
                            >
                              <div>
                                <div>{IMAGE_MODELS[key].label}</div>
                                <div className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">
                                  {IMAGE_MODELS[key].modelId}
                                </div>
                              </div>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <SectionTitle>TensorArt 配置</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <FieldLabel icon={Key}>TensorArt API Key</FieldLabel>
                      <input
                        type="password"
                        value={local.tensorartApiKey ?? ''}
                        onChange={(e) => update({ tensorartApiKey: e.target.value })}
                        placeholder="留空则使用服务器环境变量"
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors font-mono"
                      />
                    </div>
                    <div>
                      <FieldLabel>TensorArt 模型</FieldLabel>
                      <div className="space-y-1.5">
                        {(Object.keys(TENSORART_MODELS) as TensorArtModel[]).map((key) => {
                          const active = (local.tensorartModel ?? 'wai_nsfw_v16') === key
                          return (
                            <button
                              key={key}
                              onClick={() => update({ tensorartModel: key })}
                              className={cn(
                                'w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all flex items-center justify-between',
                                active
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
                              )}
                            >
                              <div>
                                <div>{TENSORART_MODELS[key].label}</div>
                                <div className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono">
                                  {TENSORART_MODELS[key].modelId}
                                </div>
                              </div>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            <section>
              <SectionTitle>画风风格</SectionTitle>
              <div className="space-y-1.5">
                {(Object.keys(IMAGE_STYLES) as ImageStyle[]).map((key) => {
                  const active = local.imageStyle === key
                  return (
                    <button
                      key={key}
                      onClick={() => update({ imageStyle: key })}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all flex items-center justify-between',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <div>
                        <div>{IMAGE_STYLES[key].label}</div>
                        {IMAGE_STYLES[key].tags && (
                          <div className="text-[10px] text-muted-foreground/50 mt-0.5 font-mono truncate max-w-xs">
                            {IMAGE_STYLES[key].tags}
                          </div>
                        )}
                      </div>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              <div className="mt-4">
                <FieldLabel icon={Palette}>自定义风格 Tags</FieldLabel>
                <textarea
                  value={local.imageStyleCustom ?? ''}
                  onChange={(e) => update({ imageStyleCustom: e.target.value })}
                  placeholder="输入额外的 danbooru 风格 tags，逗号分隔（追加到所选画风之后）"
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary transition-colors resize-none font-mono"
                />
                <p className="text-[11px] text-muted-foreground/50 mt-1">
                  示例：flat color, ink, 1990s anime style
                </p>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Save button */}
      <div className="pt-4 border-t border-border mt-6">
        <button
          onClick={handleSave}
          className={cn(
            'w-full py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2',
            saved
              ? 'bg-green-600/20 text-green-400 border border-green-600/40'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          )}
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              已保存
            </>
          ) : (
            '保存设置'
          )}
        </button>
      </div>
    </div>
  )
}
