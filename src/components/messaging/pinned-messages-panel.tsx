'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import { formatRelativeTimeTR } from '@/lib/utils/format'
import type { Message } from '@/lib/messaging'

interface PinnedMessagesPanelProps {
  pinnedMessages: Message[]
  onMessageClick: (messageId: string) => void
  onUnpin: (messageId: string) => void
  loading?: boolean
}

export function PinnedMessagesPanel({
  pinnedMessages,
  onMessageClick,
  onUnpin,
  loading = false,
}: PinnedMessagesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (pinnedMessages.length === 0 && !loading) {
    return null
  }

  return (
    <div className="border-b border-border bg-muted/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icons.pin className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">
            Sabitlenmiş Mesajlar ({pinnedMessages.length}/30)
          </span>
        </div>
        <Icons.chevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="max-h-[200px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Icons.spinner className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {pinnedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-3 hover:bg-muted/50 transition-colors flex items-start gap-3 group"
                >
                  <button
                    onClick={() => onMessageClick(msg.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {msg.senderName}
                      </p>
                      <span className="text-xs text-muted-foreground/70">
                        {formatRelativeTimeTR(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 break-words">
                      {msg.content}
                    </p>
                  </button>
                  <button
                    onClick={() => onUnpin(msg.id)}
                    className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    title="Sabitlemeyi kaldır"
                  >
                    <Icons.pinOff className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
