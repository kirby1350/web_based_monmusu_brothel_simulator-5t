'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { getGameSave, saveGameSave, importSaveFromFile } from '@/lib/storage'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const save = getGameSave()
    if (save) {
      router.replace('/game')
    } else {
      setReady(true)
    }
  }, [router])

  const handleImport = async () => {
    setError(null)
    setImporting(true)
    try {
      const data = await importSaveFromFile()
      saveGameSave(data)
      router.replace('/game')
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请检查文件格式')
      setImporting(false)
    }
  }

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm gold-text tracking-widest">魔物娘娼馆</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background px-6 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold gold-text tracking-widest">魔物娘娼馆</h1>
        <p className="text-sm text-muted-foreground">未检测到存档，请选择开始方式</p>
      </div>

      <div className="flex flex-col w-full max-w-xs gap-3">
        <Button
          className="h-12 text-sm font-semibold glow-btn"
          onClick={() => router.push('/setup')}
        >
          新游戏
        </Button>

        <Button
          variant="outline"
          className="h-12 text-sm gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
          disabled={importing}
          onClick={handleImport}
        >
          <Upload className="w-4 h-4" />
          {importing ? '正在导入...' : '读取本地存档文件'}
        </Button>

        {error && (
          <p className="text-xs text-rose-400 text-center mt-1">{error}</p>
        )}

        <p className="text-[11px] text-muted-foreground/40 text-center mt-2">
          支持导入之前通过"设置 → 存档管理 → 导出为文件"保存的 .json 存档
        </p>
      </div>
    </div>
  )
}
