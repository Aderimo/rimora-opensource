'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import { formatRelativeTimeTR } from '@/lib/utils/format'
import type { Message } from '@/lib/messaging'
import { MessageContextMenu } from './message-context-menu'
import { EditHistoryModal } from './edit-history-modal'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  onPin: (messageId: string) => void
  onUnpin: (messageId: string) => void
  onEdit: (messageId: string, newContent: string) => void
  onReply: (message: Message) => void
  onQuoteClick: (messageId: string) => void
  isPinned: boolean
  canPin: boolean
}

export function MessageBubble({
  message,
  isOwn,
  onPin,
  onUnpin,
  onEdit,
  onReply,
  onQuoteClick,
  isPinned,
  canPin,
}: MessageBubbleProps) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showEditHistory, setShowEditHistory] = useState(false)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const handleLongPress = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setContextMenuPosition({ x: touch.clientX, y: touch.clientY })
    setShowContextMenu(true)
  }

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleEditCancel = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  return (
    <>
      <div
        data-message-id={message.id}
        className={cn('flex group', isOwn ? 'justify-end' : 'justify-start')}
        onContextMenu={handleContextMenu}
        onTouchStart={handleLongPress}
      >
        <div
          className={cn(
            'max-w-[70%] rounded-2xl px-4 py-2 relative transition-opacity',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted rounded-bl-md',
            message.isEdited && 'opacity-90'
          )}
        >
          {/* Pin Indicator */}
          {isPinned && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <Icons.pin className="h-3 w-3 text-white" />
            </div>
          )}

          {/* Reply Quote Preview */}
          {message.replyTo && (
            <button
              onClick={() => onQuoteClick(message.replyTo!.messageId)}
              className={cn(
                'w-full mb-2 p-2 rounded-lg border-l-2 text-left',
                isOwn
                  ? 'bg-primary-foreground/10 border-primary-foreground/30'
                  : 'bg-background/50 border-muted-foreground/30'
              )}
            >
              <p
                className={cn(
                  'text-xs font-medium mb-1',
                  isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}
              >
                {message.replyTo.senderName}
              </p>
              <p
                className={cn(
                  'text-xs line-clamp-2',
                  isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground/80'
                )}
              >
                {message.replyTo.quotedContent}
              </p>
            </button>
          )}

          {/* Message Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[60px] p-2 rounded-lg bg-background/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleEditSubmit()
                  }
                  if (e.key === 'Escape') {
                    handleEditCancel()
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEditSubmit}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Kaydet
                </button>
                <button
                  onClick={handleEditCancel}
                  className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

              {/* Timestamp and Edited Label */}
              <div className="flex items-center gap-2 mt-1">
                <p
                  className={cn(
                    'text-xs',
                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  {formatRelativeTimeTR(message.createdAt)}
                </p>
                {message.isEdited && (
                  <button
                    onClick={() => setShowEditHistory(true)}
                    className={cn(
                      'text-xs flex items-center gap-1 hover:underline',
                      isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                    title="Düzenleme geçmişini görüntüle"
                  >
                    <Icons.edit className="h-3 w-3" />
                    düzenlendi
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <MessageContextMenu
          message={message}
          isOwn={isOwn}
          isPinned={isPinned}
          canPin={canPin}
          onPin={() => onPin(message.id)}
          onUnpin={() => onUnpin(message.id)}
          onEdit={() => setIsEditing(true)}
          onReply={() => onReply(message)}
          position={contextMenuPosition}
          onClose={() => setShowContextMenu(false)}
        />
      )}

      {/* Edit History Modal */}
      {showEditHistory && (
        <EditHistoryModal
          message={message}
          isOpen={showEditHistory}
          onClose={() => setShowEditHistory(false)}
        />
      )}
    </>
  )
}
