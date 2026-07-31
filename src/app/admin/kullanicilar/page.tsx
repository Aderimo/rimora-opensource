'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getUserRole, type UserRole, ROLE_INFO, isUserBanned, type BanInfo } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface User {
  id: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  createdAt: Timestamp | null
  role: UserRole
  banInfo: BanInfo | null
}

type SortField = 'createdAt' | 'displayName' | 'email'
type SortDirection = 'asc' | 'desc'

export default function UsersManagementPage() {
  const router = useRouter()
  const { isAuthorized, isLoading, role } = useAdminAuth({
    requiredRole: 'moderator',
    redirectTo: '/'
  })

  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [banFilter, setBanFilter] = useState<'all' | 'banned' | 'active'>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  
  const USERS_PER_PAGE = 20

  useEffect(() => {
    if (isAuthorized && !isLoading) {
      loadUsers()
    }
  }, [isAuthorized, isLoading])

  useEffect(() => {
    filterAndSortUsers()
  }, [users, searchQuery, roleFilter, banFilter, sortField, sortDirection])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      // Kullanıcıları yükle
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(100) // İlk 100 kullanıcı
      )
      
      const usersSnap = await getDocs(usersQuery)
      setLastDoc(usersSnap.docs[usersSnap.docs.length - 1])

      // Kullanıcı verilerini işle
      const usersData = await Promise.all(
        usersSnap.docs.map(async (doc) => {
          const data = doc.data()
          const userRole = await getUserRole(doc.id, data.email)
          const banInfo = await isUserBanned(doc.id)
          
          return {
            id: doc.id,
            displayName: data.displayName || null,
            email: data.email || null,
            photoURL: data.photoURL || null,
            createdAt: data.createdAt || null,
            role: userRole,
            banInfo
          }
        })
      )

      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortUsers = () => {
    let filtered = [...users]

    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user => 
        user.displayName?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      )
    }

    // Rol filtresi
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    // Ban filtresi
    if (banFilter === 'banned') {
      filtered = filtered.filter(user => user.banInfo !== null)
    } else if (banFilter === 'active') {
      filtered = filtered.filter(user => user.banInfo === null)
    }

    // Sıralama
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'createdAt':
          aValue = a.createdAt?.toMillis() || 0
          bValue = b.createdAt?.toMillis() || 0
          break
        case 'displayName':
          aValue = a.displayName?.toLowerCase() || ''
          bValue = b.displayName?.toLowerCase() || ''
          break
        case 'email':
          aValue = a.email?.toLowerCase() || ''
          bValue = b.email?.toLowerCase() || ''
          break
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Sayfalama
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE)
  const startIndex = (currentPage - 1) * USERS_PER_PAGE
  const endIndex = startIndex + USERS_PER_PAGE
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
        <Icons.shield className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">Yetkisiz Erişim</h1>
        <p className="text-muted-foreground mt-2">Bu sayfaya erişim için yönetici yetkisi gerekiyor.</p>
        <Button onClick={() => router.push('/')} variant="link" className="text-white mt-4">
          Ana Sayfaya Dön
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="gap-2">
                <Icons.arrowLeft className="h-4 w-4" />
                Admin Panel
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Icons.users className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">Kullanıcı Yönetimi</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredUsers.length} kullanıcı
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filtreler */}
        <div className="bg-card border border-white/10 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Arama */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Ara</label>
              <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="İsim, email veya ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-black/20 border-white/10"
                />
              </div>
            </div>

            {/* Rol Filtresi */}
            <div>
              <label className="text-sm font-medium mb-2 block">Rol</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tümü</option>
                <option value="founder">Kurucu</option>
                <option value="admin">Yönetici</option>
                <option value="moderator">Moderatör</option>
                <option value="user">Kullanıcı</option>
              </select>
            </div>

            {/* Ban Filtresi */}
            <div>
              <label className="text-sm font-medium mb-2 block">Durum</label>
              <select
                value={banFilter}
                onChange={(e) => setBanFilter(e.target.value as 'all' | 'banned' | 'active')}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">Tümü</option>
                <option value="active">Aktif</option>
                <option value="banned">Banlı</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kullanıcı Listesi */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
              {/* Tablo Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-black/20 border-b border-white/10 text-sm font-medium text-muted-foreground">
                <div className="col-span-4 flex items-center gap-2 cursor-pointer" onClick={() => toggleSort('displayName')}>
                  Kullanıcı
                  {sortField === 'displayName' && (
                    <Icons.arrowUp className={cn("h-3 w-3 transition-transform", sortDirection === 'desc' && "rotate-180")} />
                  )}
                </div>
                <div className="col-span-3 flex items-center gap-2 cursor-pointer" onClick={() => toggleSort('email')}>
                  Email
                  {sortField === 'email' && (
                    <Icons.arrowUp className={cn("h-3 w-3 transition-transform", sortDirection === 'desc' && "rotate-180")} />
                  )}
                </div>
                <div className="col-span-2">Rol</div>
                <div className="col-span-2 flex items-center gap-2 cursor-pointer" onClick={() => toggleSort('createdAt')}>
                  Kayıt Tarihi
                  {sortField === 'createdAt' && (
                    <Icons.arrowUp className={cn("h-3 w-3 transition-transform", sortDirection === 'desc' && "rotate-180")} />
                  )}
                </div>
                <div className="col-span-1 text-right">İşlemler</div>
              </div>

              {/* Tablo Body */}
              <div className="divide-y divide-white/10">
                {currentUsers.length === 0 ? (
                  <div className="px-6 py-12 text-center text-muted-foreground">
                    Kullanıcı bulunamadı
                  </div>
                ) : (
                  currentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-colors"
                    >
                      {/* Kullanıcı */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{user.displayName || 'İsimsiz'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.id}</p>
                        </div>
                        {user.banInfo && (
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium">
                              <Icons.ban className="h-3 w-3" />
                              Banlı
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Email */}
                      <div className="col-span-3 flex items-center">
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email || 'Email yok'}
                        </p>
                      </div>

                      {/* Rol */}
                      <div className="col-span-2 flex items-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${ROLE_INFO[user.role].color}20`,
                            color: ROLE_INFO[user.role].color
                          }}
                        >
                          {ROLE_INFO[user.role].emoji} {ROLE_INFO[user.role].label}
                        </span>
                      </div>

                      {/* Kayıt Tarihi */}
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-muted-foreground">
                          {user.createdAt?.toDate().toLocaleDateString('tr-TR') || 'Bilinmiyor'}
                        </p>
                      </div>

                      {/* İşlemler */}
                      <div className="col-span-1 flex items-center justify-end">
                        <Link href={`/admin/kullanicilar/${user.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Icons.eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sayfalama */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-white/10"
                >
                  <Icons.arrowLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={cn(
                          "w-8 h-8 p-0",
                          currentPage !== pageNum && "border-white/10"
                        )}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-white/10"
                >
                  <Icons.arrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
