// Email Notification Sistemi
import { db } from './firebase'
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, orderBy } from 'firebase/firestore'

export interface EmailNotification {
    id: string
    userId: string
    userEmail: string
    notificationType: 'warning' | 'mute' | 'ban' | 'unban' | 'appeal_update'
    subject: string
    message: string
    reason?: string
    duration?: string
    sentAt: Date
    read: boolean
}

// Email şablonları
const EMAIL_TEMPLATES = {
    warning: {
        subject: '⚠️ Uyarı Alındınız',
        getBody: (reason: string, duration?: string) => `
            <h2>Platformda Uyarı Aldınız</h2>
            <p>Sevgili Kullanıcı,</p>
            <p>Platform kurallarını ihlal ettiğiniz için bir uyarı almışsınız.</p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Neden:</strong> ${reason}</p>
                ${duration ? `<p><strong>Geçerlilik Süresi:</strong> ${duration} saat</p>` : '<p><strong>Geçerlilik Süresi:</strong> Kalıcı</p>'}
            </div>
            
            <p>Bu davranışın tekrarı daha ciddi cezalara yol açabilir.</p>
            <p>Sorularınız varsa itiraz sistemini kullanabilirsiniz.</p>
            
            <p>Saygılarımızla,<br>Moderasyon Ekibi</p>
        `
    },
    mute: {
        subject: '🔇 Geçici Olarak Susturuldunuz',
        getBody: (reason: string, duration?: string) => `
            <h2>Geçici Olarak Susturuldunuz</h2>
            <p>Sevgili Kullanıcı,</p>
            <p>Platform kurallarını ihlal ettiğiniz için geçici olarak susturulmuşsunuz.</p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Neden:</strong> ${reason}</p>
                <p><strong>Süre:</strong> ${duration} dakika</p>
            </div>
            
            <p>Bu süre içinde hiç bir mesaj göndereemeyeceksiniz.</p>
            <p>Sorularınız varsa itiraz sistemini kullanabilirsiniz.</p>
            
            <p>Saygılarımızla,<br>Moderasyon Ekibi</p>
        `
    },
    ban: {
        subject: '🚫 Hesabınız Banlandı',
        getBody: (reason: string, duration?: string) => `
            <h2>Hesap Banı</h2>
            <p>Sevgili Kullanıcı,</p>
            <p>Ciddi kural ihlalleri nedeniyle hesabınız banlanmıştır.</p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Neden:</strong> ${reason}</p>
                ${duration 
                    ? `<p><strong>Ban Süresi:</strong> ${duration} gün (Geçici Ban)</p>`
                    : '<p><strong>Ban Süresi:</strong> Kalıcı Ban</p>'
                }
            </div>
            
            <p>Ban kararına itiraz etmek istiyorsanız, platformda itiraz sistemini kullanabilirsiniz.</p>
            
            <p>Saygılarımızla,<br>Moderasyon Ekibi</p>
        `
    },
    unban: {
        subject: '✅ Ban Kaldırıldı',
        getBody: (reason: string = '', duration?: string) => `
            <h2>Ban Kaldırıldı</h2>
            <p>Sevgili Kullanıcı,</p>
            <p>Ban cezanız sonlanmıştır. Platformu yeniden kullanabilirsiniz.</p>
            
            <p>Lütfen platform kurallarına uyduğunuzdan emin olunuz.</p>
            
            <p>Hoşgeldiniz!<br>Moderasyon Ekibi</p>
        `
    },
    appeal_update: {
        subject: '📋 İtiraz Durumu Güncellendi',
        getBody: (status: string, reason?: string) => `
            <h2>İtiraz Sonucu</h2>
            <p>Sevgili Kullanıcı,</p>
            <p>İtirazınız incelenmiş ve sonuca varılmıştır.</p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Sonuç:</strong> ${status}</p>
                ${reason ? `<p><strong>Açıklama:</strong> ${reason}</p>` : ''}
            </div>
            
            <p>İtiraz panelinde ayrıntıları görebilirsiniz.</p>
            
            <p>Saygılarımızla,<br>Moderasyon Ekibi</p>
        `
    }
}

// Email gönder (Cloud Function ile entegre olacak)
export async function sendEmailNotification(
    userId: string,
    userEmail: string,
    notificationType: 'warning' | 'mute' | 'ban' | 'unban' | 'appeal_update',
    reason?: string,
    duration?: string,
    status?: string
): Promise<void> {
    try {
        const template = EMAIL_TEMPLATES[notificationType]
        let body = ''
        
        // Template'e göre parametreleri ayarla
        if (notificationType === 'appeal_update') {
            body = template.getBody(status || '', reason || '')
        } else {
            body = template.getBody(reason || '', duration || '')
        }
        
        // Firestore'a kaydet (Cloud Function tarafından işlenecek)
        await setDoc(doc(db, 'emailQueue', `${userId}_${Date.now()}`), {
            userId,
            userEmail,
            notificationType,
            subject: template.subject,
            body,
            reason: reason || null,
            createdAt: serverTimestamp(),
            sent: false,
            attempts: 0
        })

        // Notification belgesine de kaydet
        await setDoc(doc(db, 'notifications', `${userId}_${Date.now()}`), {
            userId,
            userEmail,
            notificationType,
            subject: template.subject,
            message: body,
            reason: reason || null,
            duration: duration || null,
            sentAt: serverTimestamp(),
            read: false
        })
    } catch (error) {
        console.error('Error sending email notification:', error)
        throw error
    }
}

// Kullanıcının bildirimleri al
export async function getUserNotifications(userId: string): Promise<EmailNotification[]> {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            orderBy('sentAt', 'desc')
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            sentAt: doc.data().sentAt?.toDate() || new Date()
        })) as EmailNotification[]
    } catch (error) {
        console.error('Error getting user notifications:', error)
        return []
    }
}

// Bildirimi oku olarak işaretle
export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const notifRef = doc(db, 'notifications', notificationId)
        // updateDoc kullanabilir ama setDoc de çalışır
        await setDoc(notifRef, { read: true }, { merge: true })
    } catch (error) {
        console.error('Error marking notification as read:', error)
        throw error
    }
}

// Okunmamış bildirim sayısı
export async function getUnreadNotificationCount(userId: string): Promise<number> {
    try {
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('read', '==', false)
        )
        const snapshot = await getDocs(q)
        return snapshot.size
    } catch (error) {
        console.error('Error getting unread count:', error)
        return 0
    }
}
