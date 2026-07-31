'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { 
  getUserNotifications, 
  getUnreadCount, 
  markAsRead, 
  markAllAsRead,
  subscribeToNotifications,
  getNotificationClickUrl,
  type Notification 
} from '@/lib/notifications'
import { cn } from '@/lib/utils'

import { formatRelativeTimeTR } from '@/lib/utils/format'

export function NotificationBell() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Real-time subscription
  useEffect(() => {
    if (!user) return

    // Real-time notifications listener
    const unsubscribe = subscribeToNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications)
      setUnreadCount(newNotifications.filter(n => !n.read).length)
    })

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(!isOpen)
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
      // Real-time listener zaten güncelleyecek, ama hızlı feedback için local update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user) return
    try {
      await markAllAsRead(user.uid)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const formatTime = (date: Date) => {
    return formatRelativeTimeTR(date)
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'new_content': return <Icons.film className="h-4 w-4 text-purple-500" />
      case 'new_episode': return <Icons.tv className="h-4 w-4 text-pink-500" />
      case 'follow': return <Icons.user className="h-4 w-4 text-blue-500" />
      case 'comment': return <Icons.info className="h-4 w-4 text-green-500" />
      case 'like': return <Icons.heart className="h-4 w-4 text-red-500" />
      case 'message': return <Icons.info className="h-4 w-4 text-blue-400" />
      case 'watch_party': return <Icons.tv className="h-4 w-4 text-purple-400" />
      case 'friend_activity': return <Icons.user className="h-4 w-4 text-green-400" />
      default: return <Icons.info className="h-4 w-4" />
    }
  }

  const getNotificationLink = (notification: Notification) => {
    return getNotificationClickUrl(notification)
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className="relative"
        aria-label={`Bildirimler${unreadCount > 0 ? `, ${unreadCount} okunmamış` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Icons.bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center" aria-label={`${unreadCount} okunmamış bildirim`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden" role="dialog" aria-label="Bildirimler menüsü">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold" id="notifications-heading">Bildirimler</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-primary hover:underline"
                aria-label="Tüm bildirimleri okundu olarak işaretle"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto" role="list" aria-labelledby="notifications-heading">
            {loading ? (
              <div className="flex justify-center py-8" role="status" aria-label="Bildirimler yükleniyor">
                <Icons.spinner className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const link = getNotificationLink(notification)
                  const Content = (
                    <div
                      role="listitem"
                      className={cn(
                        'flex gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer',
                        !notification.read && 'bg-primary/5'
                      )}
                      onClick={() => {
                        if (!notification.read) {
                          handleMarkAsRead(notification.id)
                        }
                        setIsOpen(false)
                      }}
                      aria-label={`${notification.title}. ${notification.message}. ${notification.read ? 'Okundu' : 'Okunmadı'}`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center" aria-hidden="true">
                        {notification.fromUserPhoto ? (
                          <Image
                            src={notification.fromUserPhoto}
                            alt=""
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        ) : (
                          getNotificationIcon(notification.type)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <time dateTime={notification.createdAt.toISOString()}>
                            {formatTime(notification.createdAt)}
                          </time>
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" aria-label="Okunmadı" />
                      )}
                    </div>
                  )

                  return (
                    <Link key={notification.id} href={link}>
                      {Content}
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground" role="status">
                <Icons.info className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">Henüz bildirim yok</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
