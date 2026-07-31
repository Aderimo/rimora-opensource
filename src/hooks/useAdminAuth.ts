/**
 * Admin Yetkilendirme Hook
 * 
 * Admin panel sayfalarında kullanılmak üzere yetki kontrolü sağlar.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getUserRole, hasPermission, type UserRole, ROLE_RESTRICTIONS } from '@/lib/roles'
import { useRouter } from 'next/navigation'

interface UseAdminAuthOptions {
  requiredRole?: UserRole
  redirectTo?: string
  onUnauthorized?: () => void
}

interface AdminAuthState {
  isAuthorized: boolean
  isLoading: boolean
  role: UserRole
  permissions: typeof ROLE_RESTRICTIONS.founder
  checkPermission: (permission: keyof typeof ROLE_RESTRICTIONS.founder) => boolean
}

/**
 * Admin yetkilendirme hook'u
 * @param options - Yetkilendirme seçenekleri
 * @returns AdminAuthState - Yetkilendirme durumu
 */
export function useAdminAuth(options: UseAdminAuthOptions = {}): AdminAuthState {
  const {
    requiredRole = 'moderator',
    redirectTo = '/',
    onUnauthorized
  } = options

  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('user')
  const [permissions, setPermissions] = useState(ROLE_RESTRICTIONS.user)

  useEffect(() => {
    async function checkAuth() {
      // Auth yükleniyor
      if (authLoading) {
        return
      }

      // Kullanıcı giriş yapmamış
      if (!user) {
        setIsAuthorized(false)
        setIsLoading(false)
        
        if (onUnauthorized) {
          onUnauthorized()
        } else {
          router.push(redirectTo)
        }
        return
      }

      try {
        // Kullanıcının rolünü al
        const userRole = await getUserRole(user.uid, user.email || undefined)
        setRole(userRole)
        setPermissions(ROLE_RESTRICTIONS[userRole])

        // Yetki kontrolü
        const hasAccess = hasPermission(userRole, requiredRole)
        setIsAuthorized(hasAccess)

        if (!hasAccess) {
          if (onUnauthorized) {
            onUnauthorized()
          } else {
            router.push(redirectTo)
          }
        }
      } catch (error) {
        console.error('Admin auth check error:', error)
        setIsAuthorized(false)
        router.push(redirectTo)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [user, authLoading, requiredRole, redirectTo, router, onUnauthorized])

  const checkPermission = (permission: keyof typeof ROLE_RESTRICTIONS.founder): boolean => {
    return permissions[permission]
  }

  return {
    isAuthorized,
    isLoading,
    role,
    permissions,
    checkPermission
  }
}

/**
 * Basit yetki kontrolü hook'u - sadece boolean döner
 * @param requiredRole - Minimum gerekli rol
 * @returns boolean - Yetkili mi?
 */
export function useHasRole(requiredRole: UserRole): boolean {
  const { user, loading } = useAuth()
  const [hasRole, setHasRole] = useState(false)

  useEffect(() => {
    async function checkRole() {
      if (loading || !user) {
        setHasRole(false)
        return
      }

      const userRole = await getUserRole(user.uid, user.email || undefined)
      setHasRole(hasPermission(userRole, requiredRole))
    }

    checkRole()
  }, [user, loading, requiredRole])

  return hasRole
}

/**
 * Belirli bir izin için kontrol hook'u
 * @param permission - Kontrol edilecek izin
 * @returns boolean - İzin var mı?
 */
export function useHasPermission(permission: keyof typeof ROLE_RESTRICTIONS.founder): boolean {
  const { user, loading } = useAuth()
  const [hasPermissionState, setHasPermissionState] = useState(false)

  useEffect(() => {
    async function checkPerm() {
      if (loading || !user) {
        setHasPermissionState(false)
        return
      }

      const userRole = await getUserRole(user.uid, user.email || undefined)
      setHasPermissionState(ROLE_RESTRICTIONS[userRole][permission])
    }

    checkPerm()
  }, [user, loading, permission])

  return hasPermissionState
}
