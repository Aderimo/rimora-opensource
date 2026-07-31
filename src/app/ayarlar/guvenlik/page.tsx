'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { use2FA } from '@/hooks/use2FA'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { toast } from 'sonner'
import { Shield, Smartphone, Key, AlertTriangle, Fingerprint, QrCode, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { maskPhoneNumber } from '@/lib/auth/two-factor'
import {
  setupTOTP,
  verifyTOTPToken,
  saveTOTPConfig,
  getTOTPConfig,
  disableTOTP,
  getTOTPErrorMessage,
  generateQRCodeDataURL,
} from '@/lib/auth/totp'
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  startWebAuthnRegistration,
  createWebAuthnCredential,
  saveWebAuthnCredential,
  getWebAuthnCredentials,
  deleteWebAuthnCredential,
  getDeviceType,
  type WebAuthnCredential,
} from '@/lib/auth/webauthn'
import {
  sendEmailVerificationCode,
  verifyEmailCode,
  isEmail2FAEnabled,
  enableEmail2FA,
  disableEmail2FA,
  saveRecoveryEmail,
  verifyRecoveryEmail,
  getRecoveryEmail,
  deleteRecoveryEmail,
  getEmail2FAErrorMessage,
} from '@/lib/auth/email-2fa'

// QR Code Display Component
function QRCodeDisplay({ url }: { url: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await generateQRCodeDataURL(url)
        setQrDataUrl(dataUrl)
      } catch (error) {
        console.error('QR kod oluşturma hatası:', error)
      } finally {
        setLoading(false)
      }
    }
    generateQR()
  }, [url])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-[200px] h-[200px]">
        <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!qrDataUrl) {
    return (
      <div className="flex items-center justify-center w-[200px] h-[200px] text-sm text-muted-foreground">
        QR kod yüklenemedi
      </div>
    )
  }

  return (
    <img
      src={qrDataUrl}
      alt="TOTP QR Code"
      width={200}
      height={200}
      className="rounded"
    />
  )
}

type AuthMethod = 'sms' | 'totp' | 'webauthn'

export default function SecuritySettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    isEnrolling,
    isVerifying,
    isUnenrolling,
    verificationId,
    enrolledFactors,
    is2FAActive,
    error,
    startEnrollment,
    completeEnrollment,
    removeFactor,
    clearError,
  } = use2FA()

  const [phoneNumber, setPhoneNumber] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [showEnrollForm, setShowEnrollForm] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>('sms')
  
  // TOTP state
  const [totpSecret, setTotpSecret] = useState<string>('')
  const [totpQRCode, setTotpQRCode] = useState<string>('')
  const [totpToken, setTotpToken] = useState('')
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[]>([])
  const [showTotpSetup, setShowTotpSetup] = useState(false)
  const [totpStep, setTotpStep] = useState<'qr' | 'verify' | 'backup'>('qr')
  
  // WebAuthn state
  const [webAuthnSupported, setWebAuthnSupported] = useState(false)
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)
  const [webAuthnCredentials, setWebAuthnCredentials] = useState<WebAuthnCredential[]>([])
  const [showWebAuthnSetup, setShowWebAuthnSetup] = useState(false)
  const [webAuthnDeviceName, setWebAuthnDeviceName] = useState('')
  
  // Loading states
  const [isLoadingTotp, setIsLoadingTotp] = useState(false)
  const [isLoadingWebAuthn, setIsLoadingWebAuthn] = useState(false)
  
  // Email 2FA state
  const [email2FAEnabled, setEmail2FAEnabled] = useState(false)
  const [showEmail2FASetup, setShowEmail2FASetup] = useState(false)
  const [email2FACode, setEmail2FACode] = useState('')
  const [isLoadingEmail2FA, setIsLoadingEmail2FA] = useState(false)
  
  // Recovery Email state
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryEmailVerified, setRecoveryEmailVerified] = useState(false)
  const [showRecoveryEmailSetup, setShowRecoveryEmailSetup] = useState(false)
  const [recoveryEmailCode, setRecoveryEmailCode] = useState('')
  const [isLoadingRecoveryEmail, setIsLoadingRecoveryEmail] = useState(false)

  // Check WebAuthn support on mount
  useEffect(() => {
    const checkWebAuthn = async () => {
      setWebAuthnSupported(isWebAuthnSupported())
      setPlatformAuthAvailable(await isPlatformAuthenticatorAvailable())
    }
    checkWebAuthn()
  }, [])

  // Load TOTP and WebAuthn status
  useEffect(() => {
    if (!user) return

    const loadSecurityMethods = async () => {
      // Check TOTP
      const totpConfig = await getTOTPConfig(user.uid)
      setTotpEnabled(!!totpConfig?.enabled)

      // Load WebAuthn credentials
      const credentials = await getWebAuthnCredentials(user.uid)
      setWebAuthnCredentials(credentials)
      
      // Check Email 2FA
      const email2FAStatus = await isEmail2FAEnabled(user.uid)
      setEmail2FAEnabled(email2FAStatus)
      
      // Load Recovery Email
      const recoveryEmailData = await getRecoveryEmail(user.uid)
      if (recoveryEmailData) {
        setRecoveryEmail(recoveryEmailData.email)
        setRecoveryEmailVerified(recoveryEmailData.verified)
      }
    }

    loadSecurityMethods()
  }, [user])

  if (!user) {
    router.push('/giris')
    return null
  }

  // TOTP Handlers
  const handleStartTotpSetup = async () => {
    if (!user.email) {
      toast.error('E-posta adresi gerekli')
      return
    }

    setIsLoadingTotp(true)
    try {
      const setup = await setupTOTP(user.uid, user.email)
      setTotpSecret(setup.secret)
      setTotpQRCode(setup.qrCodeUrl)
      setTotpBackupCodes(setup.backupCodes)
      setShowTotpSetup(true)
      setTotpStep('qr')
    } catch (error: any) {
      toast.error(getTOTPErrorMessage(error))
    } finally {
      setIsLoadingTotp(false)
    }
  }

  const handleVerifyTotp = async () => {
    if (!totpToken || totpToken.length !== 6) {
      toast.error('6 haneli kodu girin')
      return
    }

    setIsLoadingTotp(true)
    try {
      const isValid = verifyTOTPToken(totpSecret, totpToken)
      
      if (!isValid) {
        toast.error('Geçersiz kod')
        return
      }

      await saveTOTPConfig(user.uid, totpSecret)
      setTotpEnabled(true)
      setTotpStep('backup')
      toast.success('TOTP başarıyla aktif edildi')
    } catch (error: any) {
      toast.error(getTOTPErrorMessage(error))
    } finally {
      setIsLoadingTotp(false)
    }
  }

  const handleDisableTotp = async () => {
    if (!confirm('TOTP\'yi devre dışı bırakmak istediğinizden emin misiniz?')) {
      return
    }

    setIsLoadingTotp(true)
    try {
      await disableTOTP(user.uid)
      setTotpEnabled(false)
      setShowTotpSetup(false)
      toast.success('TOTP devre dışı bırakıldı')
    } catch (error: any) {
      toast.error(getTOTPErrorMessage(error))
    } finally {
      setIsLoadingTotp(false)
    }
  }

  const handleDownloadBackupCodes = () => {
    const text = totpBackupCodes.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rimora-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Yedek kodlar indirildi')
  }

  const handleFinishTotpSetup = () => {
    setShowTotpSetup(false)
    setTotpToken('')
    setTotpStep('qr')
  }

  // WebAuthn Handlers
  const handleStartWebAuthnSetup = async () => {
    if (!webAuthnSupported) {
      toast.error('Tarayıcınız WebAuthn desteklemiyor')
      return
    }

    const deviceName = webAuthnDeviceName || getDeviceType()
    
    setIsLoadingWebAuthn(true)
    try {
      const options = await startWebAuthnRegistration(user.uid, user.email || user.uid)
      const credential = await createWebAuthnCredential(options)
      await saveWebAuthnCredential(user.uid, credential, deviceName)
      
      // Reload credentials
      const credentials = await getWebAuthnCredentials(user.uid)
      setWebAuthnCredentials(credentials)
      
      setShowWebAuthnSetup(false)
      setWebAuthnDeviceName('')
      toast.success('Biyometrik kimlik doğrulama aktif edildi')
    } catch (error: any) {
      toast.error(error.message || 'Bir hata oluştu')
    } finally {
      setIsLoadingWebAuthn(false)
    }
  }

  const handleRemoveWebAuthnCredential = async (credentialId: string) => {
    if (!confirm('Bu cihazı kaldırmak istediğinizden emin misiniz?')) {
      return
    }

    setIsLoadingWebAuthn(true)
    try {
      await deleteWebAuthnCredential(user.uid, credentialId)
      
      // Reload credentials
      const credentials = await getWebAuthnCredentials(user.uid)
      setWebAuthnCredentials(credentials)
      
      toast.success('Cihaz kaldırıldı')
    } catch (error: any) {
      toast.error(error.message || 'Bir hata oluştu')
    } finally {
      setIsLoadingWebAuthn(false)
    }
  }

  if (!user) {
    router.push('/giris')
    return null
  }

  const handleStartEnrollment = async () => {
    if (!phoneNumber) {
      toast.error('Telefon numarası gerekli')
      return
    }

    try {
      await startEnrollment(phoneNumber)
      toast.success('Doğrulama kodu gönderildi')
    } catch (err) {
      toast.error(error || 'Bir hata oluştu')
    }
  }

  const handleCompleteEnrollment = async () => {
    if (!verificationCode) {
      toast.error('Doğrulama kodu gerekli')
      return
    }

    try {
      await completeEnrollment(verificationCode)
      toast.success('2FA başarıyla aktif edildi')
      setShowEnrollForm(false)
      setPhoneNumber('')
      setVerificationCode('')
    } catch (err) {
      toast.error(error || 'Doğrulama başarısız')
    }
  }

  const handleRemoveFactor = async (factor: any) => {
    if (!confirm('2FA\'yı kaldırmak istediğinizden emin misiniz?')) {
      return
    }

    try {
      await removeFactor(factor)
      toast.success('2FA kaldırıldı')
    } catch (err) {
      toast.error(error || 'Bir hata oluştu')
    }
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/ayarlar')}
          className="mb-4"
        >
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Ayarlara Dön
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Güvenlik Ayarları</h1>
        </div>
        <p className="text-muted-foreground">
          Hesabınızı iki faktörlü kimlik doğrulama ile koruyun
        </p>
      </div>

      {/* 2FA Status Card */}
      <div className={cn(
        'p-6 rounded-xl border mb-6',
        is2FAActive 
          ? 'bg-green-500/10 border-green-500/30' 
          : 'bg-muted/50 border-border'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={cn(
              'p-3 rounded-lg',
              is2FAActive ? 'bg-green-500/20' : 'bg-muted'
            )}>
              <Shield className={cn(
                'h-6 w-6',
                is2FAActive ? 'text-green-500' : 'text-muted-foreground'
              )} />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-1">
                İki Faktörlü Kimlik Doğrulama
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {is2FAActive 
                  ? 'Hesabınız 2FA ile korunuyor' 
                  : 'Hesabınızı ekstra bir güvenlik katmanı ile koruyun'}
              </p>
              
              {is2FAActive && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Icons.check className="h-4 w-4" />
                  <span>Aktif</span>
                </div>
              )}
            </div>
          </div>

          {!is2FAActive && !showEnrollForm && (
            <Button onClick={() => setShowEnrollForm(true)}>
              <Key className="h-4 w-4 mr-2" />
              Aktif Et
            </Button>
          )}
        </div>
      </div>

      {/* Enrollment Form */}
      {showEnrollForm && !is2FAActive && (
        <div className="p-6 rounded-xl border bg-card mb-6">
          <h3 className="text-lg font-semibold mb-4">2FA Kurulumu</h3>
          
          {!verificationId ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Telefon Numarası
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+90 5XX XXX XX XX"
                    className="flex-1 px-4 py-2 rounded-lg border bg-background"
                    disabled={isEnrolling}
                  />
                  <Button
                    onClick={handleStartEnrollment}
                    disabled={isEnrolling || !phoneNumber}
                  >
                    {isEnrolling ? (
                      <>
                        <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      'Kod Gönder'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Doğrulama kodu bu numaraya SMS ile gönderilecek
                </p>
              </div>

              <Button
                variant="ghost"
                onClick={() => setShowEnrollForm(false)}
              >
                İptal
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">
                      Doğrulama kodu gönderildi
                    </p>
                    <p className="text-muted-foreground">
                      {maskPhoneNumber(phoneNumber)} numarasına gönderilen 6 haneli kodu girin
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Doğrulama Kodu
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1 px-4 py-2 rounded-lg border bg-background text-center text-2xl tracking-widest"
                    disabled={isVerifying}
                  />
                  <Button
                    onClick={handleCompleteEnrollment}
                    disabled={isVerifying || verificationCode.length !== 6}
                  >
                    {isVerifying ? (
                      <>
                        <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                        Doğrulanıyor...
                      </>
                    ) : (
                      'Doğrula'
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVerificationCode('')
                    handleStartEnrollment()
                  }}
                  disabled={isEnrolling}
                >
                  Kodu Tekrar Gönder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEnrollForm(false)
                    setVerificationCode('')
                  }}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enrolled Factors */}
      {enrolledFactors.length > 0 && (
        <div className="p-6 rounded-xl border bg-card">
          <h3 className="text-lg font-semibold mb-4">Kayıtlı Cihazlar</h3>
          
          <div className="space-y-3">
            {enrolledFactors.map((factor) => (
              <div
                key={factor.uid}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{factor.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {maskPhoneNumber((factor as any).phoneNumber || '')}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFactor(factor)}
                  disabled={isUnenrolling}
                >
                  {isUnenrolling ? (
                    <Icons.spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    'Kaldır'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recaptcha Container */}
      <div id="recaptcha-container" />

      {/* TOTP (Authenticator App) Section */}
      <div className="mt-6 p-6 rounded-xl border bg-card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              'p-3 rounded-lg',
              totpEnabled ? 'bg-green-500/20' : 'bg-muted'
            )}>
              <QrCode className={cn(
                'h-6 w-6',
                totpEnabled ? 'text-green-500' : 'text-muted-foreground'
              )} />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-1">
                Authenticator App
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Google Authenticator, Authy veya Microsoft Authenticator ile güvenli giriş
              </p>
              
              {totpEnabled && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Icons.check className="h-4 w-4" />
                  <span>Aktif</span>
                </div>
              )}
            </div>
          </div>

          {!totpEnabled ? (
            <Button onClick={handleStartTotpSetup} disabled={isLoadingTotp}>
              {isLoadingTotp ? (
                <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4 mr-2" />
              )}
              Kur
            </Button>
          ) : (
            <Button variant="outline" onClick={handleDisableTotp} disabled={isLoadingTotp}>
              {isLoadingTotp ? (
                <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Devre Dışı Bırak
            </Button>
          )}
        </div>

        {/* TOTP Setup Modal */}
        {showTotpSetup && (
          <div className="mt-4 p-4 rounded-lg border bg-muted/50">
            {totpStep === 'qr' && (
              <div className="space-y-4">
                <h4 className="font-semibold">1. QR Kodu Tara</h4>
                <p className="text-sm text-muted-foreground">
                  Authenticator uygulamanızla bu QR kodu tarayın
                </p>
                
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  {totpQRCode && (
                    <QRCodeDisplay url={totpQRCode} />
                  )}
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-xs font-mono break-all">{totpSecret}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    QR kod tarayamıyorsanız bu kodu manuel olarak girin
                  </p>
                </div>

                <Button onClick={() => setTotpStep('verify')} className="w-full">
                  Devam Et
                </Button>
              </div>
            )}

            {totpStep === 'verify' && (
              <div className="space-y-4">
                <h4 className="font-semibold">2. Kodu Doğrula</h4>
                <p className="text-sm text-muted-foreground">
                  Authenticator uygulamanızda görünen 6 haneli kodu girin
                </p>

                <div>
                  <input
                    type="text"
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-lg border bg-background text-center text-2xl tracking-widest"
                    disabled={isLoadingTotp}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleVerifyTotp}
                    disabled={isLoadingTotp || totpToken.length !== 6}
                    className="flex-1"
                  >
                    {isLoadingTotp ? (
                      <>
                        <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                        Doğrulanıyor...
                      </>
                    ) : (
                      'Doğrula'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setTotpStep('qr')}
                    disabled={isLoadingTotp}
                  >
                    Geri
                  </Button>
                </div>
              </div>
            )}

            {totpStep === 'backup' && (
              <div className="space-y-4">
                <h4 className="font-semibold">3. Yedek Kodları Kaydet</h4>
                <p className="text-sm text-muted-foreground">
                  Bu kodları güvenli bir yerde saklayın. Cihazınıza erişiminizi kaybederseniz kullanabilirsiniz.
                </p>

                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {totpBackupCodes.map((code, i) => (
                      <div key={i} className="p-2 rounded bg-background">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleDownloadBackupCodes} variant="outline" className="flex-1">
                    <Icons.download className="h-4 w-4 mr-2" />
                    İndir
                  </Button>
                  <Button onClick={handleFinishTotpSetup} className="flex-1">
                    Tamamla
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WebAuthn (Biometric) Section */}
      {webAuthnSupported && (
        <div className="mt-6 p-6 rounded-xl border bg-card">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className={cn(
                'p-3 rounded-lg',
                webAuthnCredentials.length > 0 ? 'bg-green-500/20' : 'bg-muted'
              )}>
                <Fingerprint className={cn(
                  'h-6 w-6',
                  webAuthnCredentials.length > 0 ? 'text-green-500' : 'text-muted-foreground'
                )} />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  Biyometrik Kimlik Doğrulama
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Touch ID, Face ID veya Windows Hello ile güvenli giriş
                </p>
                
                {webAuthnCredentials.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <Icons.check className="h-4 w-4" />
                    <span>{webAuthnCredentials.length} cihaz kayıtlı</span>
                  </div>
                )}
                
                {!platformAuthAvailable && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    ⚠️ Bu cihazda platform authenticator mevcut değil
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={() => setShowWebAuthnSetup(true)}
              disabled={isLoadingWebAuthn || !platformAuthAvailable}
            >
              {isLoadingWebAuthn ? (
                <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Fingerprint className="h-4 w-4 mr-2" />
              )}
              Cihaz Ekle
            </Button>
          </div>

          {/* WebAuthn Setup */}
          {showWebAuthnSetup && (
            <div className="mt-4 p-4 rounded-lg border bg-muted/50 space-y-4">
              <h4 className="font-semibold">Biyometrik Cihaz Ekle</h4>
              <p className="text-sm text-muted-foreground">
                Cihazınızın biyometrik sensörünü kullanarak güvenli giriş yapabilirsiniz
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Cihaz Adı (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={webAuthnDeviceName}
                  onChange={(e) => setWebAuthnDeviceName(e.target.value)}
                  placeholder={getDeviceType()}
                  className="w-full px-4 py-2 rounded-lg border bg-background"
                  disabled={isLoadingWebAuthn}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleStartWebAuthnSetup}
                  disabled={isLoadingWebAuthn}
                  className="flex-1"
                >
                  {isLoadingWebAuthn ? (
                    <>
                      <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4 mr-2" />
                      Kaydet
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowWebAuthnSetup(false)
                    setWebAuthnDeviceName('')
                  }}
                  disabled={isLoadingWebAuthn}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}

          {/* Registered WebAuthn Credentials */}
          {webAuthnCredentials.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold">Kayıtlı Cihazlar</h4>
              {webAuthnCredentials.map((cred) => (
                <div
                  key={cred.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{cred.deviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        Eklendi: {new Date(cred.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveWebAuthnCredential(cred.id)}
                    disabled={isLoadingWebAuthn}
                  >
                    {isLoadingWebAuthn ? (
                      <Icons.spinner className="h-4 w-4 animate-spin" />
                    ) : (
                      'Kaldır'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
