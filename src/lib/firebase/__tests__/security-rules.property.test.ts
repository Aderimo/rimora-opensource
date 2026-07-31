/**
 * Property-Based Tests: Firebase Security Rules
 * 
 * **Property 3: Kullanıcı Verisi Erişim Kontrolü**
 * **Property 4: İzleme Geçmişi Erişim Kontrolü**
 * **Property 7: Subscription Erişim Kontrolü**
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.6**
 * 
 * Bu testler Firebase Security Rules'ın doğru çalıştığını doğrular.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
  RulesTestContext,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  // Firebase Rules dosyasını yükle
  const rulesPath = resolve(__dirname, '../../../../firestore.rules')
  const rules = readFileSync(rulesPath, 'utf8')

  // Test ortamını başlat
  testEnv = await initializeTestEnvironment({
    projectId: 'rimora-test-project',
    firestore: {
      rules,
      host: 'localhost',
      port: 8080,
    },
  })
}, 30000) // 30 saniye timeout

afterAll(async () => {
  // Test ortamını temizle
  if (testEnv) {
    await testEnv.cleanup()
  }
}, 30000) // 30 saniye timeout

beforeEach(async () => {
  // Her test öncesi Firestore'u temizle
  await testEnv.clearFirestore()
})

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Authenticated context oluşturur
 */
function getAuthContext(userId: string): RulesTestContext {
  return testEnv.authenticatedContext(userId)
}

/**
 * Unauthenticated context oluşturur
 */
function getUnauthContext(): RulesTestContext {
  return testEnv.unauthenticatedContext()
}

/**
 * Test verisi oluşturur
 */
async function seedUserData(userId: string, data: any) {
  const adminContext = testEnv.authenticatedContext(userId, { admin: true })
  const db = adminContext.firestore()
  await setDoc(doc(db, 'users', userId), data)
}

async function seedWatchProgress(userId: string, progressId: string, data: any) {
  const adminContext = testEnv.authenticatedContext(userId, { admin: true })
  const db = adminContext.firestore()
  await setDoc(doc(db, 'watchProgress', progressId), {
    ...data,
    userId,
  })
}

async function seedSubscription(userId: string, data: any) {
  const adminContext = testEnv.authenticatedContext(userId, { admin: true })
  const db = adminContext.firestore()
  await setDoc(doc(db, 'subscriptions', userId), data)
}

// ============================================================================
// PROPERTY-BASED TEST GENERATORS
// ============================================================================

/**
 * User ID generator
 */
const userIdArbitrary = fc.uuid()

/**
 * User data generator
 */
const userDataArbitrary = fc.record({
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  email: fc.emailAddress(),
  photoURL: fc.webUrl(),
  createdAt: fc.constant(Timestamp.now()),
})

/**
 * Watch progress data generator
 */
const watchProgressArbitrary = fc.record({
  mediaId: fc.integer({ min: 1, max: 999999 }),
  mediaType: fc.constantFrom('movie', 'tv', 'anime'),
  currentTime: fc.integer({ min: 0, max: 7200 }),
  duration: fc.integer({ min: 60, max: 7200 }),
  progress: fc.float({ min: 0, max: 100 }),
  lastWatched: fc.constant(Timestamp.now()),
})

/**
 * Subscription data generator
 */
const subscriptionArbitrary = fc.record({
  plan: fc.constantFrom('free', 'standard', 'premium', 'family'),
  status: fc.constantFrom('active', 'cancelled', 'expired', 'trial'),
  startDate: fc.constant(Timestamp.now()),
  endDate: fc.constant(Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))),
  autoRenew: fc.boolean(),
  billingCycle: fc.constantFrom('monthly', 'yearly'),
  price: fc.float({ min: 0, max: 200 }),
})

// ============================================================================
// PROPERTY 3: Kullanıcı Verisi Erişim Kontrolü
// ============================================================================

describe('Property 3: Kullanıcı Verisi Erişim Kontrolü', () => {
  /**
   * **Validates: Requirements 2.1**
   * 
   * Property: For any users collection okuma isteği, sadece giriş yapmış kullanıcılar erişebilmeli
   */
  it('should allow only authenticated users to read users collection', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        userDataArbitrary,
        async (targetUserId, requestingUserId, userData) => {
          // Arrange - Test verisi oluştur
          await seedUserData(targetUserId, userData)

          // Act & Assert - Authenticated user okuyabilmeli
          const authContext = getAuthContext(requestingUserId)
          const authDb = authContext.firestore()
          const authDocRef = doc(authDb, 'users', targetUserId)
          
          await assertSucceeds(getDoc(authDocRef))

          // Act & Assert - Unauthenticated user okuyamamalı
          const unauthContext = getUnauthContext()
          const unauthDb = unauthContext.firestore()
          const unauthDocRef = doc(unauthDb, 'users', targetUserId)
          
          await assertFails(getDoc(unauthDocRef))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)

  /**
   * **Validates: Requirements 2.1**
   * 
   * Property: For any user, kendi verisini oluşturabilmeli
   */
  it('should allow users to create their own user document', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userDataArbitrary,
        async (userId, userData) => {
          // Act & Assert - Kendi user document'ını oluşturabilmeli
          const authContext = getAuthContext(userId)
          const db = authContext.firestore()
          const docRef = doc(db, 'users', userId)
          
          await assertSucceeds(setDoc(docRef, userData))

          // Act & Assert - Başka kullanıcının document'ını oluşturamamalı
          const otherUserId = `other_${userId}`
          const otherDocRef = doc(db, 'users', otherUserId)
          
          await assertFails(setDoc(otherDocRef, userData))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)
})

// ============================================================================
// PROPERTY 4: İzleme Geçmişi Erişim Kontrolü
// ============================================================================

describe('Property 4: İzleme Geçmişi Erişim Kontrolü', () => {
  /**
   * **Validates: Requirements 2.2, 2.3**
   * 
   * Property: For any watchProgress verisi, sadece veri sahibi okuyabilmeli
   */
  it('should allow only the owner to read their watch progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        watchProgressArbitrary,
        async (ownerId, otherUserId, progressData) => {
          // Farklı kullanıcılar olduğundan emin ol
          fc.pre(ownerId !== otherUserId)

          // Arrange - Test verisi oluştur
          const progressId = `progress_${ownerId}_${Date.now()}`
          await seedWatchProgress(ownerId, progressId, progressData)

          // Act & Assert - Owner okuyabilmeli
          const ownerContext = getAuthContext(ownerId)
          const ownerDb = ownerContext.firestore()
          const ownerDocRef = doc(ownerDb, 'watchProgress', progressId)
          
          await assertSucceeds(getDoc(ownerDocRef))

          // Act & Assert - Başka kullanıcı okuyamamalı
          const otherContext = getAuthContext(otherUserId)
          const otherDb = otherContext.firestore()
          const otherDocRef = doc(otherDb, 'watchProgress', progressId)
          
          await assertFails(getDoc(otherDocRef))

          // Act & Assert - Unauthenticated user okuyamamalı
          const unauthContext = getUnauthContext()
          const unauthDb = unauthContext.firestore()
          const unauthDocRef = doc(unauthDb, 'watchProgress', progressId)
          
          await assertFails(getDoc(unauthDocRef))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)

  /**
   * **Validates: Requirements 2.2, 2.3**
   * 
   * Property: For any watchProgress verisi, sadece veri sahibi yazabilmeli
   */
  it('should allow only the owner to write their watch progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        watchProgressArbitrary,
        async (ownerId, otherUserId, progressData) => {
          // Farklı kullanıcılar olduğundan emin ol
          fc.pre(ownerId !== otherUserId)

          const progressId = `progress_${ownerId}_${Date.now()}_${Math.random()}`

          // Act & Assert - Owner yazabilmeli
          const ownerContext = getAuthContext(ownerId)
          const ownerDb = ownerContext.firestore()
          const ownerDocRef = doc(ownerDb, 'watchProgress', progressId)
          
          await assertSucceeds(setDoc(ownerDocRef, {
            ...progressData,
            userId: ownerId,
          }))

          // Act & Assert - Başka kullanıcı yazamamalı (kendi userId'si ile bile)
          const otherContext = getAuthContext(otherUserId)
          const otherDb = otherContext.firestore()
          const otherProgressId = `progress_${otherUserId}_${Date.now()}_${Math.random()}`
          const otherDocRef = doc(otherDb, 'watchProgress', otherProgressId)
          
          // Başka kullanıcının userId'si ile yazamaz
          await assertFails(setDoc(otherDocRef, {
            ...progressData,
            userId: ownerId, // Yanlış userId
          }))

          // Kendi userId'si ile yazabilir
          await assertSucceeds(setDoc(otherDocRef, {
            ...progressData,
            userId: otherUserId, // Doğru userId
          }))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)

  /**
   * **Validates: Requirements 2.2, 2.3**
   * 
   * Property: For any watchProgress query, sadece kendi verilerini görebilmeli
   */
  it('should only return own watch progress in queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        fc.array(watchProgressArbitrary, { minLength: 1, maxLength: 5 }),
        async (user1Id, user2Id, progressDataArray) => {
          // Farklı kullanıcılar olduğundan emin ol
          fc.pre(user1Id !== user2Id)

          // Arrange - Her iki kullanıcı için veri oluştur
          for (let i = 0; i < progressDataArray.length; i++) {
            await seedWatchProgress(
              user1Id,
              `progress_${user1Id}_${i}`,
              progressDataArray[i]
            )
            await seedWatchProgress(
              user2Id,
              `progress_${user2Id}_${i}`,
              progressDataArray[i]
            )
          }

          // Act - User1 kendi verilerini sorgulasın
          const user1Context = getAuthContext(user1Id)
          const user1Db = user1Context.firestore()
          const user1Query = query(
            collection(user1Db, 'watchProgress'),
            where('userId', '==', user1Id)
          )
          
          const user1Snapshot = await getDocs(user1Query)
          
          // Assert - Sadece kendi verileri dönmeli
          expect(user1Snapshot.size).toBe(progressDataArray.length)
          user1Snapshot.forEach(doc => {
            expect(doc.data().userId).toBe(user1Id)
          })

          // Act - User1 başkasının verilerini sorgulayamaz
          const user1QueryOther = query(
            collection(user1Db, 'watchProgress'),
            where('userId', '==', user2Id)
          )
          
          // Bu sorgu çalışabilir ama sonuç boş dönmeli (security rules filtrelemeli)
          const user1OtherSnapshot = await getDocs(user1QueryOther)
          expect(user1OtherSnapshot.size).toBe(0)
        }
      ),
      { 
        numRuns: 50, // Daha az iterasyon (çoklu veri oluşturma)
        verbose: true,
      }
    )
  }, 180000)
})

// ============================================================================
// PROPERTY 7: Subscription Erişim Kontrolü
// ============================================================================

describe('Property 7: Subscription Erişim Kontrolü', () => {
  /**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any subscription okuma isteği, kullanıcı sadece kendi subscription'ını görebilmeli
   */
  it('should allow users to read only their own subscription', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        userIdArbitrary,
        subscriptionArbitrary,
        async (user1Id, user2Id, subscriptionData) => {
          // Farklı kullanıcılar olduğundan emin ol
          fc.pre(user1Id !== user2Id)

          // Arrange - Her iki kullanıcı için subscription oluştur
          await seedSubscription(user1Id, subscriptionData)
          await seedSubscription(user2Id, {
            ...subscriptionData,
            plan: 'premium', // Farklı plan
          })

          // Act & Assert - User1 kendi subscription'ını okuyabilmeli
          const user1Context = getAuthContext(user1Id)
          const user1Db = user1Context.firestore()
          const user1DocRef = doc(user1Db, 'subscriptions', user1Id)
          
          const user1Doc = await assertSucceeds(getDoc(user1DocRef))
          expect(user1Doc.exists()).toBe(true)
          expect(user1Doc.data()?.plan).toBe(subscriptionData.plan)

          // Act & Assert - User1 başkasının subscription'ını okuyamamalı
          const user2DocRef = doc(user1Db, 'subscriptions', user2Id)
          await assertFails(getDoc(user2DocRef))

          // Act & Assert - Unauthenticated user okuyamamalı
          const unauthContext = getUnauthContext()
          const unauthDb = unauthContext.firestore()
          const unauthDocRef = doc(unauthDb, 'subscriptions', user1Id)
          
          await assertFails(getDoc(unauthDocRef))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)

  /**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any subscription yazma isteği, hiçbir kullanıcı yazamamalı (sadece server-side)
   */
  it('should prevent all users from writing subscriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        subscriptionArbitrary,
        async (userId, subscriptionData) => {
          // Act & Assert - Authenticated user yazamamalı
          const authContext = getAuthContext(userId)
          const authDb = authContext.firestore()
          const authDocRef = doc(authDb, 'subscriptions', userId)
          
          await assertFails(setDoc(authDocRef, subscriptionData))

          // Act & Assert - Unauthenticated user yazamamalı
          const unauthContext = getUnauthContext()
          const unauthDb = unauthContext.firestore()
          const unauthDocRef = doc(unauthDb, 'subscriptions', userId)
          
          await assertFails(setDoc(unauthDocRef, subscriptionData))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)

  /**
   * **Validates: Requirements 2.6**
   * 
   * Property: For any subscription ID, sadece o ID'ye sahip kullanıcı okuyabilmeli
   */
  it('should enforce subscription ID matches user ID for read access', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        subscriptionArbitrary,
        async (userId, subscriptionData) => {
          // Arrange - Subscription oluştur (ID = userId)
          await seedSubscription(userId, subscriptionData)

          // Act & Assert - Doğru kullanıcı okuyabilmeli
          const correctContext = getAuthContext(userId)
          const correctDb = correctContext.firestore()
          const correctDocRef = doc(correctDb, 'subscriptions', userId)
          
          await assertSucceeds(getDoc(correctDocRef))

          // Act & Assert - Yanlış kullanıcı okuyamamalı
          const wrongUserId = `wrong_${userId}`
          const wrongContext = getAuthContext(wrongUserId)
          const wrongDb = wrongContext.firestore()
          const wrongDocRef = doc(wrongDb, 'subscriptions', userId)
          
          await assertFails(getDoc(wrongDocRef))
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
      }
    )
  }, 120000)
})
