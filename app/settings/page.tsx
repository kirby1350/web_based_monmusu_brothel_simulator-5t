'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Download, Upload, Save, Clock, User, Coins, BookOpen } from 'lucide-react'
import {
  getSettings, saveSettings, clearGameSave, getGameSave, saveGameSave,
  getSaveSlots, writeSaveSlot, deleteSaveSlot, exportSaveToFile, importSaveFromFile,
} from '@/lib/storage'
import { AppSettings, GameSave } from '@/lib/types'
import { SettingsPanel } from '@/components/settings-panel'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_SLOTS = 3

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [currentSave, setCurrentSave] = useState<GameSave | null>(null)
  const [slots, setSlots] = useState<ReturnType<typeof getSaveSlots>>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<number | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [activeTab, setActiveTab] = useState<'model' | 'save'>('model')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSettings(getSettings())
    setCurrentSave(getGameSave())
    setSlots(getSaveSlots())
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const refreshSlots = () => setSlots(getSaveSlots())

  const handleSettingsChange = (s: AppSettings) => {
    setSettings(s)
    saveSettings(s)
  }

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      resetTimerRef.current = setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    clearGameSave()
    router.push('/setup')
  }

  const handleWriteSlot = (slotId: number) => {
    if (!currentSave) return
    writeSaveSlot(slotId, currentSave)
    refreshSlots()
    showToast(`已写入存档槽 ${slotId}`)
  }

  const handleLoadSlot = (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return
    saveGameSave(slot.data)
    setCurrentSave(slot.data)
    showToast(`已读取存档槽 ${slotId}，即将进入游戏`)
    setTimeout(() => router.push('/game'), 1200)
  }

  const handleDeleteSlot = (slotId: number) => {
    if (confirmDeleteSlot !== slotId) {
      setConfirmDeleteSlot(slotId)
      deleteTimerRef.current = setTimeout(() => setConfirmDeleteSlot(null), 4000)
      return
    }
    deleteSaveSlot(slotId)
    setConfirmDeleteSlot(null)
    refreshSlots()
    showToast(`存档槽 ${slotId} 已清除`)
  }

  const handleExport = () => {
    if (!currentSave) return
    exportSaveToFile(currentSave)
    showToast('存档已导出为 JSON 文件')
  }

  const handleImport = async () => {
    try {
      const data = await importSaveFromFile()
      saveGameSave(data)
      setCurrentSave(data)
      refreshSlots()
      showToast('存档导入成功，即将进入游戏')
      setTimeout(() => router.push('/game'), 1200)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '导入失败', 'err')
    }
  }

  if (!settings) return null

  const hasSave = !!currentSave

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm font-bold gold-text">设置</h1>
      </header>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-xs font-medium shadow-lg transition-all',
          toast.type === 'ok' ? 'bg-primary/90 text-primary-foreground' : 'bg-rose-600/90 text-white'
        )}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Top tab switcher */}
        <div className="flex border-b border-border">
          {[
            { key: 'model', label: '模型设置' },
            { key: 'save', label: '存档管理' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as 'model' | 'save')}
              className={cn(
                'px-5 py-3 text-sm border-b-2 transition-colors -mb-px',
                activeTab === key
                  ? 'border-primary text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'model' && (
          <div className="bg-card border border-border rounded-xl p-6">
            <SettingsPanel settings={settings} onSettingsChange={handleSettingsChange} />
          </div>
        )}

        {activeTab === 'save' && (
          <div className="space-y-4">
            {/* Current save info */}
            {hasSave && currentSave && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">当前运行存档</h2>
                <div className="grid grid-cols-3 gap-3">
                  <InfoChip icon={User} label="馆主" value={currentSave.player.name} />
                  <InfoChip icon={BookOpen} label="第 N 天" value={`第 ${currentSave.currentDay} 天`} />
                  <InfoChip icon={Coins} label="金币" value={`${currentSave.player.gold} G`} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={handleExport}>
                    <Download className="w-3.5 h-3.5" />
                    导出为文件
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={handleImport}>
                    <Upload className="w-3.5 h-3.5" />
                    从文件导入
                  </Button>
                </div>
              </div>
            )}

            {!hasSave && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">当前无运行存档</h2>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleImport}>
                  <Upload className="w-3.5 h-3.5" />
                  从文件导入存档
                </Button>
              </div>
            )}

            {/* Save slots */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">本地存档槽（{MAX_SLOTS} 个）</h2>
              <div className="space-y-3">
                {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((slotId) => {
                  const slot = slots.find((s) => s.id === slotId)
                  const isConfirmingDelete = confirmDeleteSlot === slotId
                  return (
                    <div
                      key={slotId}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground/70">槽位 {slotId}</span>
                          {slot && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {slot.name}
                            </span>
                          )}
                        </div>
                        {slot ? (
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <User className="w-3 h-3" />{slot.preview.playerName}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <BookOpen className="w-3 h-3" />第 {slot.preview.day} 天
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Coins className="w-3 h-3" />{slot.preview.gold} G
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(slot.savedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/40 mt-1">空槽位</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasSave && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="w-7 h-7 border-border/60 hover:border-primary/60"
                            title="写入此槽位"
                            onClick={() => handleWriteSlot(slotId)}
                          >
                            <Save className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {slot && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] border-primary/40 text-primary hover:bg-primary/10"
                              onClick={() => handleLoadSlot(slotId)}
                            >
                              读取
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className={cn(
                                'w-7 h-7',
                                isConfirmingDelete
                                  ? 'border-rose-500 text-rose-400 hover:bg-rose-500/10'
                                  : 'border-rose-500/20 text-rose-400/50 hover:border-rose-500/60 hover:text-rose-400'
                              )}
                              title={isConfirmingDelete ? '再次点击确认删除' : '删除此槽位'}
                              onClick={() => handleDeleteSlot(slotId)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground/40">
                存档槽保存于浏览器本地缓存（localStorage），清除浏览器数据时可能丢失，请定期使用"导出为文件"备份。
              </p>
            </div>

            {/* Reset */}
            {hasSave && (
              <div className="bg-card border border-rose-500/20 rounded-xl p-5">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">危险操作</h2>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-foreground">重置存档</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      删除当前运行存档并返回角色创建界面，此操作不可撤销
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      confirmReset
                        ? 'border-rose-500 text-rose-400 hover:bg-rose-500/10'
                        : 'border-rose-500/30 text-rose-400/70 hover:border-rose-500 hover:text-rose-400'
                    }
                    onClick={handleReset}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {confirmReset ? '再次点击确认' : '重置存档'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoChip({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <span className="text-xs font-semibold text-foreground truncate">{value}</span>
    </div>
  )
}
