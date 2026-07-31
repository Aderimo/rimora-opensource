'use client'

import { useEffect, useState } from 'react'
import { Icons } from '@/components/icons'
import { formatRelativeTimeTR } from '@/lib/utils/format'
import { getEditHistory, type Message, type EditHistoryEntry } from '@/lib/messaging'

interface EditHistoryModalProps {
  message: Message
  isOpen: boolean
  onClose: () => void
}

export function EditHistoryModal({ message, isOpen, onClose }: EditHistoryModalProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadHistory() {
      if (!isOpen) return
      setLoading(true)
      try {
        const data = await getEditHistory(message.id)
        setHistory(data)
      } catch (error) {
        console.error('Error loading edit history:', error)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [message.id, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in-0">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Düzenleme Geçmişi</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Icons.close className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              {/* Current Version */}
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-primary">Güncel Versiyon</span>
                  <span className="text-xs text-muted-foreground">
                    {message.lastEditedAt
                      ? formatRelativeTimeTR(message.lastEditedAt)
                      : formatRelativeTimeTR(message.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>

              {/* Edit History */}
              {history.map((entry, index) => (
                <div key={index} className="p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.edit className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTimeTR(entry.editedAt)}
                    </span>
                  </div>

                  {/* Before */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Önceki:</p>
                    <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground/70 line-through">
                      {entry.originalContent}
                    </p>
                  </div>

                  {/* After */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Sonraki:</p>
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {entry.editedContent}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icons.info className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Düzenleme geçmişi bulunamadı</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
