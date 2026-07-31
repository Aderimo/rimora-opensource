/**
 * E-posta Modülü
 * 
 * Resend API ile e-posta gönderimi için merkezi export noktası.
 */

export {
  sendWelcomeEmail,
  sendSubscriptionConfirmEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionExpiringEmail,
  sendPasswordResetEmail,
  sendEmail,
  type EmailResult,
  type WelcomeEmailData,
  type SubscriptionEmailData,
  type PasswordResetEmailData,
} from './resend'

export {
  getWelcomeEmailTemplate,
  getSubscriptionConfirmTemplate,
  getSubscriptionCancelledTemplate,
  getSubscriptionExpiringTemplate,
  getPasswordResetTemplate,
} from './templates'
