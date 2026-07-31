'use client'

import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/messaging'

interface MessageInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  replyingTo: Message | null
  onCancelReply: () => void
  disabled?: boolean
}

export function MessageInput({
  value,
  onChange,
  onSubmit,
  replyingTo,
  onCancelReply,
  disabled = false,
}: MessageInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply()
    }
  }

  return (
    <div className="p-4 border-t border-border">
      {/* Reply Preview Banner */}
      {replyingTo && (
        <div className="mb-3 p-3 bg-muted rounded-lg border-l-2 border-primary flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Icons.reply className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">
                {replyingTo.senderName} kişisine yanıt veriyorsunuz
              </p>
            </div>
            <p className="text-sm text-muted-foreground/80 line-clamp-2 break-words">
              {replyingTo.content}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 hover:bg-background rounded transition-colors flex-shrink-0"
            title="Yanıtı iptal et"
          >
            <Icons.close className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? 'Yanıtınızı yazın...' : 'Mesajınızı yazın...'}
          className="flex-1 h-10 px-4 rounded-full bg-muted border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={disabled}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            disabled || !value.trim()
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {disabled ? (
            <Icons.spinner className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
