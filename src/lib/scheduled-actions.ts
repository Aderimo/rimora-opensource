// Scheduled Actions - Otomatik İşlemler (Cron Jobs)
import { db } from './firebase'
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { sendEmailNotification } from './email-notifications'

// Geçici banları otomatik olarak kaldır
export async function processScheduledUnbans(): Promise<{ unbanCount: number; errors: string[] }> {
    try {
        const errors: string[] = []
        let unbanCount = 0

        // Süresi geçen tüm banları bul
        const bansSnap = await getDocs(collection(db, 'bans'))
        const now = new Date()

        for (const banDoc of bansSnap.docs) {
            const ban = banDoc.data()

            // Kalıcı ban değilse ve süresi geçmişse
            if (
                !ban.permanent &&
                ban.expiresAt &&
                new Date(ban.expiresAt.toDate ? ban.expiresAt.toDate() : ban.expiresAt) < now
            ) {
                try {
                    // Kullanıcının ban'ını kaldır
                    const userRef = doc(db, 'users', ban.userId)
                    await updateDoc(userRef, {
                        isBanned: false,
                        banExpiresAt: null
                    })

                    // Ban belgesini işaretle
                    await updateDoc(banDoc.ref, {
                        autoRemovedAt: serverTimestamp(),
                        status: 'expired'
                    })

                    // Email gönder
                    try {
                        await sendEmailNotification(
                            ban.userId,
                            ban.userEmail || '',
                            'unban'
                        )
                    } catch (emailError) {
                        console.error(`Error sending unban email to ${ban.userId}:`, emailError)
                        errors.push(`Email error for user ${ban.userId}`)
                    }

                    unbanCount++
                } catch (error) {
                    console.error(`Error processing unban for ${ban.userId}:`, error)
                    errors.push(`Processing error for user ${ban.userId}`)
                }
            }
        }

        // Log işlemi
        await logScheduledAction('process_unbans', {
            unbanCount,
            errorCount: errors.length
        })

        return { unbanCount, errors }
    } catch (error) {
        console.error('Error processing scheduled unbans:', error)
        throw error
    }
}

// Süresi geçen uyarıları temizle
export async function processExpiredWarnings(): Promise<{ expiredCount: number; errors: string[] }> {
    try {
        const errors: string[] = []
        let expiredCount = 0

        const warningsSnap = await getDocs(collection(db, 'warnings'))
        const now = new Date()

        for (const warningDoc of warningsSnap.docs) {
            const warning = warningDoc.data()

            if (
                warning.expiresAt &&
                new Date(warning.expiresAt.toDate ? warning.expiresAt.toDate() : warning.expiresAt) < now &&
                warning.status === 'active'
            ) {
                try {
                    await updateDoc(warningDoc.ref, {
                        status: 'expired'
                    })
                    expiredCount++
                } catch (error) {
                    console.error(`Error processing expired warning:`, error)
                    errors.push(`Processing error for warning ${warningDoc.id}`)
                }
            }
        }

        await logScheduledAction('process_expired_warnings', {
            expiredCount,
            errorCount: errors.length
        })

        return { expiredCount, errors }
    } catch (error) {
        console.error('Error processing expired warnings:', error)
        throw error
    }
}

// Süresi geçen mute'ları kaldır
export async function processExpiredMutes(): Promise<{ unmutedCount: number; errors: string[] }> {
    try {
        const errors: string[] = []
        let unmutedCount = 0

        const mutesSnap = await getDocs(collection(db, 'mutes'))
        const now = new Date()

        for (const muteDoc of mutesSnap.docs) {
            const mute = muteDoc.data()

            if (
                mute.expiresAt &&
                new Date(mute.expiresAt.toDate ? mute.expiresAt.toDate() : mute.expiresAt) < now
            ) {
                try {
                    // Kullanıcının mute'ını kaldır
                    const userRef = doc(db, 'users', mute.userId)
                    await updateDoc(userRef, {
                        isMuted: false,
                        muteExpiresAt: null
                    })

                    // Mute belgesini işaretle
                    await updateDoc(muteDoc.ref, {
                        autoRemovedAt: serverTimestamp(),
                        status: 'expired'
                    })

                    unmutedCount++
                } catch (error) {
                    console.error(`Error processing expired mute for ${mute.userId}:`, error)
                    errors.push(`Processing error for mute of user ${mute.userId}`)
                }
            }
        }

        await logScheduledAction('process_expired_mutes', {
            unmutedCount,
            errorCount: errors.length
        })

        return { unmutedCount, errors }
    } catch (error) {
        console.error('Error processing expired mutes:', error)
        throw error
    }
}

// Süresi geçen itirazları kapat
export async function processExpiredAppeals(): Promise<{ dismissedCount: number; errors: string[] }> {
    try {
        const errors: string[] = []
        let dismissedCount = 0

        const appealsSnap = await getDocs(collection(db, 'appeals'))
        const now = new Date()

        for (const appealDoc of appealsSnap.docs) {
            const appeal = appealDoc.data()

            if (
                appeal.expiresAt &&
                new Date(appeal.expiresAt.toDate ? appeal.expiresAt.toDate() : appeal.expiresAt) < now &&
                appeal.status === 'pending'
            ) {
                try {
                    await updateDoc(appealDoc.ref, {
                        status: 'dismissed'
                    })
                    dismissedCount++
                } catch (error) {
                    console.error(`Error processing expired appeal:`, error)
                    errors.push(`Processing error for appeal ${appealDoc.id}`)
                }
            }
        }

        await logScheduledAction('process_expired_appeals', {
            dismissedCount,
            errorCount: errors.length
        })

        return { dismissedCount, errors }
    } catch (error) {
        console.error('Error processing expired appeals:', error)
        throw error
    }
}

// Tüm scheduled işlemleri çalıştır
export async function runAllScheduledActions(): Promise<{
    unbans: { unbanCount: number; errors: string[] }
    expiredWarnings: { expiredCount: number; errors: string[] }
    expiredMutes: { unmutedCount: number; errors: string[] }
    expiredAppeals: { dismissedCount: number; errors: string[] }
}> {
    try {
        console.log('Running all scheduled actions...')

        const results = {
            unbans: await processScheduledUnbans(),
            expiredWarnings: await processExpiredWarnings(),
            expiredMutes: await processExpiredMutes(),
            expiredAppeals: await processExpiredAppeals()
        }

        // Ana log
        await logScheduledAction('run_all_scheduled', {
            timestamp: new Date(),
            results
        })

        console.log('Scheduled actions completed:', results)
        return results
    } catch (error) {
        console.error('Error running all scheduled actions:', error)
        throw error
    }
}

// Scheduled action logu
async function logScheduledAction(
    action: string,
    details: Record<string, any>
): Promise<void> {
    try {
        await setDoc(doc(db, 'scheduledActionLogs', `${action}_${Date.now()}`), {
            action,
            details,
            executedAt: serverTimestamp(),
            success: true
        })
    } catch (error) {
        console.error('Error logging scheduled action:', error)
    }
}

// --- CRON JOB SETUP TALIMATLARI ---
/*

Firebase Cloud Functions kullanarak bu fonksiyonları otomatik olarak çalıştırmak için:

1. Firebase CLI'yı kurın:
   npm install -g firebase-tools

2. Cloud Functions yapısı oluşturun:
   firebase init functions

3. functions/src/index.ts'e ekleyin:

   import * as functions from 'firebase-functions'
   import { runAllScheduledActions } from '../../../src/lib/scheduled-actions'

   // Her 1 saatte bir çalış
   export const scheduledMaintenance = functions
       .pubsub.schedule('every 1 hours')
       .timeZone('Europe/Istanbul')
       .onRun(async (context) => {
           try {
               const results = await runAllScheduledActions()
               console.log('Scheduled tasks completed:', results)
               return results
           } catch (error) {
               console.error('Error in scheduled tasks:', error)
               throw error
           }
       })

4. Deploy edin:
   firebase deploy --only functions

NOT: Bu versiyonda basit şekilde yazılmıştır.
Tam production için error handling ve retry logic eklenmelidir.

*/
