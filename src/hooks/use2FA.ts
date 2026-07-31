/**
 * Two-Factor Authentication Hook
 */

import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  startPhoneEnrollment,
  completePhoneEnrollment,
  getEnrolledFactors,
  unenrollFactor,
  is2FAEnabled,
  formatPhoneNumber,
  get2FAErrorMessage,
  type MultiFactorInfo,
} from '@/lib/auth/two-factor'

interface Use2FAReturn {
  // State
  isEnrolling: boolean
  isVerifying: boolean
  isUnenrolling: boolean
  verificationId: string | null
  enrolledFactors: MultiFactorInfo[]
  is2FAActive: boolean
  error: string | null
  
  // Actions
  startEnrollment: (phoneNumber: string) => Promise<void>
  completeEnrollment: (verificationCode: string, displayName?: string) => Promise<void>
  removeFactor: (factor: MultiFactorInfo) => Promise<void>
  clearError: () => void
  refreshFactors: () => void
}

export function use2FA(): Use2FAReturn {
  const { user } = useAuth()
  
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isUnenrolling, setIsUnenrolling] = useState(false)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [enrolledFactors, setEnrolledFactors] = useState<MultiFactorInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  // Enrolled faktörleri yükle
  const refreshFactors = useCallback(() => {
    if (user) {
      const factors = getEnrolledFactors(user)
      setEnrolledFactors(factors)
    }
  }, [user])

  // Component mount olduğunda faktörleri yükle
  useState(() => {
    refreshFactors()
  })

  // 2FA enrollment başlat
  const startEnrollment = useCallback(
    async (phoneNumber: string) => {
      if (!user) {
        setError('Kullanıcı oturumu bulunamadı')
        return
      }

      setIsEnrolling(true)
      setError(null)

      try {
        const formattedPhone = formatPhoneNumber(phoneNumber)
        const verificationId = await startPhoneEnrollment(user, formattedPhone)
        setVerificationId(verificationId)
      } catch (err: any) {
        setError(get2FAErrorMessage(err))
        throw err
      } finally {
        setIsEnrolling(false)
      }
    },
    [user]
  )

  // 2FA enrollment tamamla
  const completeEnrollment = useCallback(
    async (verificationCode: string, displayName: string = 'Telefon') => {
      if (!user || !verificationId) {
        setError('Doğrulama ID bulunamadı')
        return
      }

      setIsVerifying(true)
      setError(null)

      try {
        await completePhoneEnrollment(user, verificationId, verificationCode, displayName)
        setVerificationId(null)
        refreshFactors()
      } catch (err: any) {
        setError(get2FAErrorMessage(err))
        throw err
      } finally {
        setIsVerifying(false)
      }
    },
    [user, verificationId, refreshFactors]
  )

  // 2FA faktörünü kaldır
  const removeFactor = useCallback(
    async (factor: MultiFactorInfo) => {
      if (!user) {
        setError('Kullanıcı oturumu bulunamadı')
        return
      }

      setIsUnenrolling(true)
      setError(null)

      try {
        await unenrollFactor(user, factor)
        refreshFactors()
      } catch (err: any) {
        setError(get2FAErrorMessage(err))
        throw err
      } finally {
        setIsUnenrolling(false)
      }
    },
    [user, refreshFactors]
  )

  // Hata mesajını temizle
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isEnrolling,
    isVerifying,
    isUnenrolling,
    verificationId,
    enrolledFactors,
    is2FAActive: user ? is2FAEnabled(user) : false,
    error,
    startEnrollment,
    completeEnrollment,
    removeFactor,
    clearError,
    refreshFactors,
  }
}
