'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { 
  subscribeToPushNotifications, 
  setupTokenRefreshListener, 
  stopTokenRefreshListener,
  clearAllUserTokens 
} from '@/lib/push-notifications'

interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  bio?: string
  showEmail?: boolean
  createdAt?: Date
  role?: string
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<{ user: User }>
  signInWithGoogle: () => Promise<{ user: User }>
  signOut: () => Promise<void>
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile)
        } else {
          // Create profile if doesn't exist
          const profile: UserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          }
          await setDoc(doc(db, 'users', user.uid), {
            ...profile,
            createdAt: serverTimestamp(),
          })
          setUserProfile(profile)
        }

        // FCM token yönetimini başlat
        try {
          await subscribeToPushNotifications(user.uid)
          setupTokenRefreshListener(user.uid)
        } catch (error) {
          console.error('FCM token setup error:', error)
        }
      } else {
        setUserProfile(null)
        
        // FCM token yönetimini durdur
        stopTokenRefreshListener()
      }

      setLoading(false)
    })

    return () => {
      unsubscribe()
      // Cleanup FCM listeners
      stopTokenRefreshListener()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Update display name
    await updateProfile(user, { displayName })

    // Create user profile in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName,
      photoURL: null,
      createdAt: serverTimestamp(),
    })

    return { user }
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const userCredential = await signInWithPopup(auth, provider)
    const user = userCredential.user

    // Check if user profile exists
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      })

      // Yeni Google kullanıcısı için hoş geldin e-postası gönder
      if (user.email) {
        fetch('/api/email/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            email: user.email,
            userName: user.displayName || 'Kullanıcı',
          }),
        }).catch(console.error)
      }
    }

    return { user }
  }

  const signOut = async () => {
    // Çıkış yapmadan önce FCM token'larını temizle
    if (user) {
      try {
        await clearAllUserTokens(user.uid)
        stopTokenRefreshListener()
      } catch (error) {
        console.error('Error clearing FCM tokens on logout:', error)
      }
    }
    
    await firebaseSignOut(auth)
  }

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return

    await setDoc(doc(db, 'users', user.uid), data, { merge: true })
    setUserProfile((prev) => prev ? { ...prev, ...data } : null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
