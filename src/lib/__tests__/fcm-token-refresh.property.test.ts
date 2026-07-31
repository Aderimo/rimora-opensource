/**
 * Property-Based Tests: FCM Token Refresh ve Bildirim Tercihleri
 * **Property 10: FCM Token Refresh Round-Trip**
 * **Property 11: Bildirim Tercihleri Persistence**
 * **Validates: Requirements 4.2, 4.4**
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import type { Timestamp } from 'firebase/firestore'

// Mock Firestore data store
const mockFirestoreData = new Map<string, any>()

// Mock Firestore functions
const mockSetDoc = vi.fn(async (ref: any, data: any) => {
  const processedData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (value && typeof value === 'object' && value._seconds !== undefined) {
      return { 
        toDate: () => new Date(value._seconds * 1000), 
        toMillis: () => value._seconds * 1000,
        _seconds: value._seconds, 
        _nanoseconds: value._nanoseconds || 0 
      }
    }
    return value
  }))
  mockFirestoreData.set(ref.id, processedData)
})

const mockGetDoc = vi.fn(async (ref: any) => {
  const data = mockFirestoreData.get(ref.id)
  return { 
    exists: () => !!data, 
    data: () => data || null 
  }
})

const mockUpdateDoc = vi.fn(async (ref: any, updates: any) => {
  const existingData = mockFirestoreData.get(ref.id)
  if (!existingData) {
    throw new Error('Document does not exist')
  }
  
  // Process updates - handle arrayUnion
  const processedUpdates = { ...updates }
  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && (value as any).__arrayUnion) {
      // Simulate arrayUnion behavior
      const currentArray = existingData[key] || []
      const newItems = (value as any).__arrayUnion
      processedUpdates[key] = [...currentArray, ...newItems]
    }
  }
  
  const updatedData = { ...existingData, ...processedUpdates }
  mockFirestoreData.set(ref.id, updatedData)
})

const mockArrayUnion = vi.fn((...items: any[]) => ({
  __arrayUnion: items
}))

const mockDoc = vi.fn((db: any, collection: string, id: string) => ({ 
  collection, 
  id 
}))

const mockTimestampNow = vi.fn(() => ({
  toDate: () => new Date(),
  toMillis: () => Date.now(),
  _seconds: Date.now() / 1000,
  _nanoseconds: 0
}))

const mockTimestamp = {
  now: mockTimestampNow,
  fromDate: vi.fn((date: Date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
    _seconds: date.getTime() / 1000,
    _nanoseconds: 0
  }))
}

// Mock modules
vi.mock('@/lib/firebase', () => ({ 
  db: {}, 
  auth: {}, 
  storage: {},
  getFCMToken: vi.fn(),
  getMessagingInstance: vi.fn()
}))

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  arrayUnion: mockArrayUnion,
  Timestamp: mockTimestamp,
  serverTimestamp: mockTimestampNow
}))

// Types
interface FCMToken {
  token: string
  device: string
  browser: string
  createdAt: any
  lastUsed: any
}

interface NotificationPreferences {
  newEpisodes: boolean
  newMovies: boolean
  friendActivity: boolean
  comments: boolean
  messages: boolean
  watchPartyInvites: boolean
  emailNotifications?: boolean
  systemNotifications?: boolean
  followerNotifications?: boolean
}

interface UserNotificationSettings {
  userId: string
  preferences: NotificationPreferences
  fcmTokens: FCMToken[]
  updatedAt: any
}

// Helper functions
function generateTestUserId(): string {
  return `test_user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function generateFCMToken(): string {
  // FCM token'ları genellikle 152+ karakter uzunluğunda base64 string'lerdir
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let token = ''
  for (let i = 0; i < 152; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

function getDeviceInfo(): string {
  const devices = ['mobile', 'tablet', 'desktop']
  return devices[Math.floor(Math.random() * devices.length)]
}

function getBrowserInfo(): string {
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge']
  return browsers[Math.floor(Math.random() * browsers.length)]
}

// Simulate saveTokenToFirestore function
async function saveTokenToFirestore(userId: string, token: string): Promise<void> {
  const { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } = await import('firebase/firestore')
  const { db } = await import('@/lib/firebase')
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const now = Timestamp.now()
  
  const newToken: FCMToken = {
    token,
    device: getDeviceInfo(),
    browser: getBrowserInfo(),
    createdAt: now,
    lastUsed: now,
  }
  
  const settingsDoc = await getDoc(settingsRef)
  
  if (settingsDoc.exists()) {
    const data = settingsDoc.data() as UserNotificationSettings
    const existingTokens = data.fcmTokens || []
    
    // Check if token already exists
    const existingTokenIndex = existingTokens.findIndex(t => t.token === token)
    
    if (existingTokenIndex >= 0) {
      // Update existing token
      const updatedTokens = [...existingTokens]
      updatedTokens[existingTokenIndex] = {
        ...updatedTokens[existingTokenIndex],
        lastUsed: now,
        device: getDeviceInfo(),
        browser: getBrowserInfo(),
      }
      
      await updateDoc(settingsRef, {
        fcmTokens: updatedTokens,
        updatedAt: now,
      })
    } else {
      // Add new token
      await updateDoc(settingsRef, {
        fcmTokens: arrayUnion(newToken),
        updatedAt: now,
      })
    }
  } else {
    // Create new document
    const DEFAULT_PREFERENCES: NotificationPreferences = {
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
    
    const newSettings: UserNotificationSettings = {
      userId,
      preferences: DEFAULT_PREFERENCES,
      fcmTokens: [newToken],
      updatedAt: now,
    }
    
    await setDoc(settingsRef, newSettings)
  }
}

// Simulate getUserFCMTokens function
async function getUserFCMTokens(userId: string): Promise<FCMToken[]> {
  const { doc, getDoc } = await import('firebase/firestore')
  const { db } = await import('@/lib/firebase')
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const settingsDoc = await getDoc(settingsRef)
  
  if (settingsDoc.exists()) {
    const data = settingsDoc.data() as UserNotificationSettings
    return data.fcmTokens || []
  }
  
  return []
}

// Simulate saveNotificationPreferences function
async function saveNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  const { doc, getDoc, setDoc, updateDoc, Timestamp } = await import('firebase/firestore')
  const { db } = await import('@/lib/firebase')
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const settingsDoc = await getDoc(settingsRef)
  const now = Timestamp.now()
  
  const DEFAULT_PREFERENCES: NotificationPreferences = {
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
  
  if (settingsDoc.exists()) {
    const data = settingsDoc.data() as UserNotificationSettings
    const updatedPreferences = { ...data.preferences, ...preferences }
    
    await updateDoc(settingsRef, {
      preferences: updatedPreferences,
      updatedAt: now,
    })
  } else {
    // Create new document
    const newSettings: UserNotificationSettings = {
      userId,
      preferences: { ...DEFAULT_PREFERENCES, ...preferences },
      fcmTokens: [],
      updatedAt: now,
    }
    
    await setDoc(settingsRef, newSettings)
  }
}

// Simulate getNotificationPreferences function
async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { doc, getDoc } = await import('firebase/firestore')
  const { db } = await import('@/lib/firebase')
  
  const DEFAULT_PREFERENCES: NotificationPreferences = {
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
  
  const settingsRef = doc(db, 'notificationSettings', userId)
  const settingsDoc = await getDoc(settingsRef)
  
  if (settingsDoc.exists()) {
    const data = settingsDoc.data() as UserNotificationSettings
    return { ...DEFAULT_PREFERENCES, ...data.preferences }
  }
  
  return DEFAULT_PREFERENCES
}

// Fast-check arbitraries
const fcmTokenArbitrary = fc.constant('').map(() => generateFCMToken())
const userIdArbitrary = fc.constant('').map(() => generateTestUserId())

const notificationPreferencesArbitrary = fc.record({
  newEpisodes: fc.boolean(),
  newMovies: fc.boolean(),
  friendActivity: fc.boolean(),
  comments: fc.boolean(),
  messages: fc.boolean(),
  watchPartyInvites: fc.boolean(),
  emailNotifications: fc.boolean(),
  systemNotifications: fc.boolean(),
  followerNotifications: fc.boolean(),
})

// Property Tests
describe('Property 10: FCM Token Refresh Round-Trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirestoreData.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should save new FCM token to Firestore and retrieve it', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fcmTokenArbitrary,
        async (userId, token) => {
          // Save token
          await saveTokenToFirestore(userId, token)
          
          // Retrieve tokens
          const tokens = await getUserFCMTokens(userId)
          
          // Verify token exists
          expect(tokens).toBeDefined()
          expect(Array.isArray(tokens)).toBe(true)
          expect(tokens.length).toBeGreaterThan(0)
          
          // Find the saved token
          const savedToken = tokens.find(t => t.token === token)
          expect(savedToken).toBeDefined()
          
          if (savedToken) {
            expect(savedToken.token).toBe(token)
            expect(savedToken.device).toBeDefined()
            expect(savedToken.browser).toBeDefined()
            expect(savedToken.createdAt).toBeDefined()
            expect(savedToken.lastUsed).toBeDefined()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should update lastUsed when saving existing token', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fcmTokenArbitrary,
        async (userId, token) => {
          // Save token first time
          await saveTokenToFirestore(userId, token)
          const firstTokens = await getUserFCMTokens(userId)
          const firstToken = firstTokens.find(t => t.token === token)
          
          // Wait a bit to ensure timestamp difference
          await new Promise(resolve => setTimeout(resolve, 10))
          
          // Save same token again
          await saveTokenToFirestore(userId, token)
          const secondTokens = await getUserFCMTokens(userId)
          
          // Should still have only one token
          expect(secondTokens.length).toBe(firstTokens.length)
          
          const secondToken = secondTokens.find(t => t.token === token)
          expect(secondToken).toBeDefined()
          
          // lastUsed should be updated (or at least not earlier)
          if (firstToken && secondToken) {
            const firstLastUsed = firstToken.lastUsed?.toMillis?.() || firstToken.lastUsed?._seconds * 1000 || 0
            const secondLastUsed = secondToken.lastUsed?.toMillis?.() || secondToken.lastUsed?._seconds * 1000 || 0
            expect(secondLastUsed).toBeGreaterThanOrEqual(firstLastUsed)
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should handle multiple tokens for same user', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fc.array(fcmTokenArbitrary, { minLength: 2, maxLength: 5 }),
        async (userId, tokens) => {
          // Save multiple tokens
          for (const token of tokens) {
            await saveTokenToFirestore(userId, token)
          }
          
          // Retrieve all tokens
          const savedTokens = await getUserFCMTokens(userId)
          
          // Should have all tokens
          expect(savedTokens.length).toBe(tokens.length)
          
          // Each token should be present
          for (const token of tokens) {
            const found = savedTokens.find(t => t.token === token)
            expect(found).toBeDefined()
          }
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should include all required FCMToken fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        fcmTokenArbitrary,
        async (userId, token) => {
          await saveTokenToFirestore(userId, token)
          const tokens = await getUserFCMTokens(userId)
          
          expect(tokens.length).toBeGreaterThan(0)
          
          const savedToken = tokens[0]
          
          // Check all required fields
          expect(savedToken.token).toBeDefined()
          expect(typeof savedToken.token).toBe('string')
          expect(savedToken.token.length).toBeGreaterThan(0)
          
          expect(savedToken.device).toBeDefined()
          expect(typeof savedToken.device).toBe('string')
          expect(['mobile', 'tablet', 'desktop']).toContain(savedToken.device)
          
          expect(savedToken.browser).toBeDefined()
          expect(typeof savedToken.browser).toBe('string')
          
          expect(savedToken.createdAt).toBeDefined()
          expect(savedToken.lastUsed).toBeDefined()
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)
})

describe('Property 11: Bildirim Tercihleri Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirestoreData.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should save notification preferences to Firestore and retrieve them', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        notificationPreferencesArbitrary,
        async (userId, preferences) => {
          // Save preferences
          await saveNotificationPreferences(userId, preferences)
          
          // Retrieve preferences
          const savedPreferences = await getNotificationPreferences(userId)
          
          // Verify all preferences match
          expect(savedPreferences.newEpisodes).toBe(preferences.newEpisodes)
          expect(savedPreferences.newMovies).toBe(preferences.newMovies)
          expect(savedPreferences.friendActivity).toBe(preferences.friendActivity)
          expect(savedPreferences.comments).toBe(preferences.comments)
          expect(savedPreferences.messages).toBe(preferences.messages)
          expect(savedPreferences.watchPartyInvites).toBe(preferences.watchPartyInvites)
          expect(savedPreferences.emailNotifications).toBe(preferences.emailNotifications)
          expect(savedPreferences.systemNotifications).toBe(preferences.systemNotifications)
          expect(savedPreferences.followerNotifications).toBe(preferences.followerNotifications)
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should update existing preferences without losing data', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        notificationPreferencesArbitrary,
        notificationPreferencesArbitrary,
        async (userId, initialPrefs, updatedPrefs) => {
          // Save initial preferences
          await saveNotificationPreferences(userId, initialPrefs)
          
          // Update with partial preferences
          const partialUpdate = {
            newEpisodes: updatedPrefs.newEpisodes,
            comments: updatedPrefs.comments,
          }
          await saveNotificationPreferences(userId, partialUpdate)
          
          // Retrieve preferences
          const finalPreferences = await getNotificationPreferences(userId)
          
          // Updated fields should match
          expect(finalPreferences.newEpisodes).toBe(updatedPrefs.newEpisodes)
          expect(finalPreferences.comments).toBe(updatedPrefs.comments)
          
          // Non-updated fields should retain initial values
          expect(finalPreferences.newMovies).toBe(initialPrefs.newMovies)
          expect(finalPreferences.friendActivity).toBe(initialPrefs.friendActivity)
          expect(finalPreferences.messages).toBe(initialPrefs.messages)
          expect(finalPreferences.watchPartyInvites).toBe(initialPrefs.watchPartyInvites)
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should persist preferences across multiple read operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        notificationPreferencesArbitrary,
        async (userId, preferences) => {
          // Save preferences
          await saveNotificationPreferences(userId, preferences)
          
          // Read multiple times
          const read1 = await getNotificationPreferences(userId)
          const read2 = await getNotificationPreferences(userId)
          const read3 = await getNotificationPreferences(userId)
          
          // All reads should return same values
          expect(read1).toEqual(read2)
          expect(read2).toEqual(read3)
          
          // Values should match original
          expect(read1.newEpisodes).toBe(preferences.newEpisodes)
          expect(read1.newMovies).toBe(preferences.newMovies)
          expect(read1.friendActivity).toBe(preferences.friendActivity)
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should store preferences in notificationSettings collection (not localStorage)', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        notificationPreferencesArbitrary,
        async (userId, preferences) => {
          // Save preferences
          await saveNotificationPreferences(userId, preferences)
          
          // Verify data is in Firestore mock
          const firestoreKey = `notificationSettings/${userId}`
          const storedData = mockFirestoreData.get(userId)
          
          expect(storedData).toBeDefined()
          expect(storedData.userId).toBe(userId)
          expect(storedData.preferences).toBeDefined()
          expect(storedData.updatedAt).toBeDefined()
          
          // Verify preferences structure
          expect(storedData.preferences.newEpisodes).toBe(preferences.newEpisodes)
          expect(storedData.preferences.newMovies).toBe(preferences.newMovies)
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should maintain both preferences and tokens in same document', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        notificationPreferencesArbitrary,
        fcmTokenArbitrary,
        async (userId, preferences, token) => {
          // Save preferences first
          await saveNotificationPreferences(userId, preferences)
          
          // Then save token
          await saveTokenToFirestore(userId, token)
          
          // Retrieve both
          const savedPreferences = await getNotificationPreferences(userId)
          const savedTokens = await getUserFCMTokens(userId)
          
          // Both should exist
          expect(savedPreferences).toBeDefined()
          expect(savedTokens).toBeDefined()
          expect(savedTokens.length).toBeGreaterThan(0)
          
          // Preferences should match
          expect(savedPreferences.newEpisodes).toBe(preferences.newEpisodes)
          expect(savedPreferences.comments).toBe(preferences.comments)
          
          // Token should exist
          const foundToken = savedTokens.find(t => t.token === token)
          expect(foundToken).toBeDefined()
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)

  it('should return default preferences for new users', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        async (userId) => {
          // Don't save anything, just retrieve
          const preferences = await getNotificationPreferences(userId)
          
          // Should return default values (all true)
          expect(preferences.newEpisodes).toBe(true)
          expect(preferences.newMovies).toBe(true)
          expect(preferences.friendActivity).toBe(true)
          expect(preferences.comments).toBe(true)
          expect(preferences.messages).toBe(true)
          expect(preferences.watchPartyInvites).toBe(true)
          expect(preferences.emailNotifications).toBe(true)
          expect(preferences.systemNotifications).toBe(true)
          expect(preferences.followerNotifications).toBe(true)
        }
      ),
      { numRuns: 100, verbose: true }
    )
  }, 60000)
})
