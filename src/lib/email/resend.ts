/**
 * Resend E-posta Servisi
 * 
 * Bu modül Resend API kullanarak e-posta gönderimi sağlar.
 * Hoş geldin, abonelik bildirimleri ve diğer sistem e-postaları için kullanılır.
 */

import { Resend } from 'resend'
import {
  getWelcomeEmailTemplate,
  getSubscriptionConfirmTemplate,
  getSubscriptionCancelledTemplate,
  getSubscriptionExpiringTemplate,
  getPasswordResetTemplate,
  getInvoiceEmailTemplate
} from './templates'

// Resend client - server-side only
const resend = new Resend(process.env.RESEND_API_KEY || 're_missing_key')

// E-posta gönderim ayarları
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@rimora.com'
const FROM_NAME = process.env.RESEND_FROM_NAME || 'Rimora'

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface WelcomeEmailData {
  userName: string
  email: string
}

export interface SubscriptionEmailData {
  userName: string
  email: string
  plan: 'standard' | 'premium' | 'family'
  planName: string
  endDate?: string
  price?: number
  billingCycle?: 'monthly' | 'yearly'
}

export interface PasswordResetEmailData {
  userName: string
  email: string
  resetLink: string
}

export interface InvoiceEmailData {
  userName: string
  email: string
  plan: 'standard' | 'premium' | 'family'
  planName: string
  price: number
  billingCycle: 'monthly' | 'yearly'
  paymentDate: string
  invoiceNumber: string
  paymentMethod: string
  nextPaymentDate?: string
}

/**
 * Hoş geldin e-postası gönder
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getWelcomeEmailTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send welcome email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Abonelik onay e-postası gönder
 */
export async function sendSubscriptionConfirmEmail(data: SubscriptionEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getSubscriptionConfirmTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send subscription confirm email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Abonelik iptal e-postası gönder
 */
export async function sendSubscriptionCancelledEmail(data: SubscriptionEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getSubscriptionCancelledTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send subscription cancelled email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Abonelik süre dolumu uyarı e-postası gönder
 */
export async function sendSubscriptionExpiringEmail(data: SubscriptionEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getSubscriptionExpiringTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send subscription expiring email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Şifre sıfırlama e-postası gönder
 */
export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getPasswordResetTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send password reset email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Fatura e-postası gönder
 */
export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<EmailResult> {
  try {
    const { html, subject } = getInvoiceEmailTemplate(data)

    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: data.email,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send invoice email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}

/**
 * Genel e-posta gönderimi
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (error) {
    console.error('Send email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'E-posta gönderilemedi'
    }
  }
}
