'use client'

import { useEffect, useRef } from 'react'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/messaging'

interface MessageContextMenuProps {
  message: Message
  isOwn: boolean
  isPinned: boolean
  canPin: boolean
  onPin: () => void
  onUnpin: () => void
  onEdit: () => void
  onReply: () => void
  position: { x: number; y: number }
  onClose: () => void
}

export function MessageContextMenu({
  message,
  isOwn,
  isPinned,
  canPin,
  onPin,
  onUnpin,
  onEdit,
  onReply,
  position,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const menuItems = [
    {
      icon: Icons.reply,
      label: 'Yanıtla',
      onClick: () => {
        onReply()
        onClose()
      },
      show: true,
    },
    {
      icon: isPinned ? Icons.pinOff : Icons.pin,
      label: isPinned ? 'Sabitlemeyi Kaldır' : 'Sabitle',
      onClick: () => {
        if (isPinned) {
          onUnpin()
        } else {
          onPin()
        }
        onClose()
      },
      show: true,
      disabled: !isPinned && !canPin,
      tooltip: !isPinned && !canPin ? 'Maksimum 30 mesaj sabitleyebilirsiniz' : undefined,
    },
    {
      icon: Icons.edit,
      label: 'Düzenle',
      onClick: () => {
        onEdit()
        onClose()
      },
      show: isOwn,
    },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] bg-card border border-border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {menuItems
        .filter((item) => item.show)
        .map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            disabled={item.disabled}
            title={item.tooltip}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted transition-colors',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        ))}
    </div>
  )
}
