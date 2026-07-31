import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  shouldSendNotificationByType,
  getNotificationTypeDescription,
  type NotificationType 
} from '../notification-preferences'
import type { NotificationPreferences } from '../push-notifications'

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  getFCMToken: vi.fn(),
  getMessagingInstance: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: () => Date.now() })),
    fromDate: vi.fn((date: Date) => ({ toMillis: () => date.getTime() })),
  },
  arrayUnion: vi.fn(),
}))

describe('Notification Preferences', () => {
  const defaultPreferences: NotificationPreferences = {
    newEpisodes: true,
    newMovies: true,
    friendActivity: true,
    comments: true,
    messages: true,
    watchPartyInvites: true,
    emailNotifications: true,
    systemNotifications: true,
    followerNotifications: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('shouldSendNotificationByType', () => {
    it('should return true for enabled notification types', () => {
      const preferences = { ...defaultPreferences }
      
      expect(shouldSendNotificationByType(preferences, 'new_episode')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'new_movie')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'friend_activity')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'comment')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'message')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'watch_party_invite')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'follower')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'system')).toBe(true)
    })

    it('should return false for disabled notification types', () => {
      const preferences: NotificationPreferences = {
        ...defaultPreferences,
        newEpisodes: false,
        comments: false,
        messages: false,
      }
      
      expect(shouldSendNotificationByType(preferences, 'new_episode')).toBe(false)
      expect(shouldSendNotificationByType(preferences, 'comment')).toBe(false)
      expect(shouldSendNotificationByType(preferences, 'message')).toBe(false)
      
      // Diğerleri hala true olmalı
      expect(shouldSendNotificationByType(preferences, 'new_movie')).toBe(true)
      expect(shouldSendNotificationByType(preferences, 'friend_activity')).toBe(true)
    })

    it('should return true for unknown notification types', () => {
      const preferences = { ...defaultPreferences }
      
      expect(shouldSendNotificationByType(preferences, 'unknown_type' as NotificationType)).toBe(true)
    })

    it('should handle missing preference properties gracefully', () => {
      const incompletePreferences = {
        newEpisodes: true,
        // Diğer özellikler eksik
      } as NotificationPreferences
      
      // Eksik özellikler için undefined döner, bu da falsy olur
      expect(shouldSendNotificationByType(incompletePreferences, 'new_episode')).toBe(true)
      expect(shouldSendNotificationByType(incompletePreferences, 'comment')).toBe(false)
    })
  })

  describe('getNotificationTypeDescription', () => {
    it('should return correct descriptions for all notification types', () => {
      expect(getNotificationTypeDescription('new_episode')).toBe('Yeni bölüm bildirimleri')
      expect(getNotificationTypeDescription('new_movie')).toBe('Yeni film bildirimleri')
      expect(getNotificationTypeDescription('friend_activity')).toBe('Arkadaş aktivite bildirimleri')
      expect(getNotificationTypeDescription('comment')).toBe('Yorum bildirimleri')
      expect(getNotificationTypeDescription('message')).toBe('Mesaj bildirimleri')
      expect(getNotificationTypeDescription('watch_party_invite')).toBe('Birlikte izle davet bildirimleri')
      expect(getNotificationTypeDescription('follower')).toBe('Takipçi bildirimleri')
      expect(getNotificationTypeDescription('system')).toBe('Sistem bildirimleri')
    })

    it('should return default message for unknown types', () => {
      expect(getNotificationTypeDescription('unknown' as NotificationType)).toBe('Bilinmeyen bildirim türü')
    })
  })

  describe('Notification Type Mapping', () => {
    it('should correctly map all preference keys to notification types', () => {
      const testCases: Array<[keyof NotificationPreferences, NotificationType, boolean]> = [
        ['newEpisodes', 'new_episode', true],
        ['newMovies', 'new_movie', true],
        ['friendActivity', 'friend_activity', true],
        ['comments', 'comment', true],
        ['messages', 'message', true],
        ['watchPartyInvites', 'watch_party_invite', true],
        ['followerNotifications', 'follower', true],
        ['systemNotifications', 'system', true],
      ]

      testCases.forEach(([prefKey, notifType, expectedValue]) => {
        const preferences = {
          ...defaultPreferences,
          [prefKey]: expectedValue,
        }
        
        expect(shouldSendNotificationByType(preferences, notifType)).toBe(expectedValue)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty preferences object', () => {
      const emptyPreferences = {} as NotificationPreferences
      
      // Tüm değerler undefined olacak, bu da falsy
      expect(shouldSendNotificationByType(emptyPreferences, 'new_episode')).toBe(false)
      expect(shouldSendNotificationByType(emptyPreferences, 'message')).toBe(false)
      
      // Ancak follower ve system için varsayılan true döner
      expect(shouldSendNotificationByType(emptyPreferences, 'follower')).toBe(true)
      expect(shouldSendNotificationByType(emptyPreferences, 'system')).toBe(true)
    })

    it('should handle null/undefined values in preferences', () => {
      const preferences = {
        ...defaultPreferences,
        newEpisodes: null as any,
        comments: undefined as any,
      }
      
      expect(shouldSendNotificationByType(preferences, 'new_episode')).toBe(false)
      expect(shouldSendNotificationByType(preferences, 'comment')).toBe(false)
    })
  })
})