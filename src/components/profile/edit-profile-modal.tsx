'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { updateProfile } from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, storage } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

// Resmi sıkıştır
async function compressImage(file: File, maxWidth = 400, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, userProfile, updateUserProfile } = useAuth()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '')
  const [bio, setBio] = useState(userProfile?.bio || '')
  const [showEmail, setShowEmail] = useState(userProfile?.showEmail ?? false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(userProfile?.photoURL || null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  if (!isOpen || !user) return null

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 10MB limit
      if (file.size > 10 * 1024 * 1024) {
        addToast('Dosya boyutu 10MB\'dan küçük olmalı', 'error')
        return
      }

      // Only images
      if (!file.type.startsWith('image/')) {
        addToast('Sadece resim dosyaları yüklenebilir', 'error')
        return
      }

      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      addToast('Kullanıcı adı boş olamaz', 'error')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      let photoURL = userProfile?.photoURL || null

      // Upload new photo if selected
      if (photoFile) {
        setUploadProgress(10)
        addToast('Fotoğraf yükleniyor...', 'info')

        try {
          // Resmi sıkıştır
          setUploadProgress(30)
          const compressedBlob = await compressImage(photoFile, 400, 0.8)

          setUploadProgress(50)

          // Firebase Storage'a yükle
          const storageRef = ref(storage, `avatars/${user.uid}_${Date.now()}.jpg`)
          await uploadBytes(storageRef, compressedBlob, {
            contentType: 'image/jpeg',
          })

          setUploadProgress(80)
          photoURL = await getDownloadURL(storageRef)
          setUploadProgress(100)
        } catch (uploadError) {
          console.error('Photo upload error:', uploadError)
          addToast('Fotoğraf yüklenirken hata oluştu. Lütfen tekrar deneyin.', 'error')
          setLoading(false)
          setUploadProgress(0)
          return
        }
      }

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser!, {
        displayName: displayName.trim(),
        photoURL,
      })

      // Update Firestore profile
      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL,
        bio: bio.trim(),
        showEmail,
      })

      addToast('Profil başarıyla güncellendi!', 'success')
      onClose()
    } catch (error) {
      console.error('Error updating profile:', error)
      addToast('Profil güncellenirken hata oluştu', 'error')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Profili Düzenle</h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
            <Icons.close className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden bg-muted cursor-pointer group"
              onClick={() => !loading && fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <Image src={photoPreview} alt="Avatar" fill className="object-cover" sizes="96px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                  <span className="text-3xl font-bold text-white">
                    {(displayName || user.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
              {!loading && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Icons.plus className="h-8 w-8 text-white" />
                </div>
              )}
              {loading && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <div className="text-center">
                    <Icons.spinner className="h-6 w-6 animate-spin text-white mx-auto mb-1" />
                    <span className="text-xs text-white">{uploadProgress}%</span>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {loading ? 'Yükleniyor...' : 'Değiştirmek için tıklayın'}
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Kullanıcı Adı</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Kullanıcı adınız"
              className="w-full h-10 px-3 rounded-lg bg-muted border-0 focus:ring-2 focus:ring-primary text-sm"
              required
              disabled={loading}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Hakkımda</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Kendinizden kısaca bahsedin..."
              className="w-full h-20 px-3 py-2 rounded-lg bg-muted border-0 focus:ring-2 focus:ring-primary text-sm resize-none"
              maxLength={160}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/160</p>
          </div>

          {/* Email Privacy */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">E-postayı Göster</p>
              <p className="text-xs text-muted-foreground">Profilinizde e-posta görünsün mü?</p>
            </div>
            <button
              type="button"
              onClick={() => !loading && setShowEmail(!showEmail)}
              disabled={loading}
              className={`relative w-11 h-6 rounded-full transition-colors ${showEmail ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showEmail ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {showEmail && (
            <div className="text-xs text-muted-foreground px-1">
              Mevcut e-posta: {user.email}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              İptal
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <Icons.spinner className="h-4 w-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </div>
              ) : 'Kaydet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
