'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { cn } from '@/lib/utils'
import { 
  Search, 
  Users, 
  MessageCircle,
  CheckSquare,
  Square,
  Ban,
  UserCheck,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react'

type TabType = 'users' | 'comments'

interface UserData {
  id: string
  displayName: string
  email: string
  photoURL: string | null
  createdAt: Date
  status?: string
  selected?: boolean
}

interface CommentData {
  id: string
  userId: string
  userName: string
  content: string
  mediaId: number
  mediaType: string
  createdAt: Date
  selected?: boolean
}

// Audit log oluşturma fonksiyonu
async function createAuditLog(
  adminId: string,
  adminName: string,
  action: string,
  targetType: 'user' | 'comment' | 'content' | 'subscription',
  targetId: string,
  details: Record<string, unknown>
): Promise<void> {
  await addDoc(collection(db, 'auditLogs'), {
    adminId,
    adminName,
    action,
    targetType,
    targetId,
    details,
    timestamp: serverTimestamp(),
  })
}

export default function BulkActionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('users')
  const [users, setUsers] = useState<UserData[]>([])
  const [comments, setComments] = useState<CommentData[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [processing, setProcessing] = useState(false)
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'ban' | 'unban' | 'delete'
    count: number
    onConfirm: () => Promise<void>
  } | null>(null)

  // Admin kontrolü
  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        setCheckingAdmin(false)
        return
      }
      
      try {
        const modDoc = await getDocs(query(
          collection(db, 'moderators'),
          where('__name__', '==', user.uid)
        ))
        
        if (!modDoc.empty) {
          const modData = modDoc.docs[0].data()
          if (modData.role === 'founder' || modData.role === 'admin') {
            setIsAdmin(true)
          }
        }
      } catch (error) {
        console.error('Admin kontrolü hatası:', error)
      } finally {
        setCheckingAdmin(false)
      }
    }
    
    if (!loading) {
      checkAdmin()
    }
  }, [user, loading])

  // Verileri yükle
  const loadData = useCallback(async () => {
    if (!isAdmin) return
    
    setDataLoading(true)
    try {
      if (activeTab === 'users') {
        const snap = await getDocs(query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(100)
        ))
        setUsers(snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate() || new Date(),
          selected: false,
        })) as UserData[])
      } else {
        const snap = await getDocs(query(
          collection(db, 'comments'),
          orderBy('createdAt', 'desc'),
          limit(100)
        ))
        setComments(snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate() || new Date(),
          selected: false,
        })) as CommentData[])
      }
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setDataLoading(false)
    }
  }, [isAdmin, activeTab])

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin, activeTab, loadData])

  // Seçim işlemleri
  const toggleUserSelection = (userId: string) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, selected: !u.selected } : u
    ))
  }

  const toggleCommentSelection = (commentId: string) => {
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, selected: !c.selected } : c
    ))
  }

  const selectAllUsers = () => {
    const allSelected = filteredUsers.every(u => u.selected)
    setUsers(prev => prev.map(u => {
      if (filteredUsers.find(fu => fu.id === u.id)) {
        return { ...u, selected: !allSelected }
      }
      return u
    }))
  }

  const selectAllComments = () => {
    const allSelected = filteredComments.every(c => c.selected)
    setComments(prev => prev.map(c => {
      if (filteredComments.find(fc => fc.id === c.id)) {
        return { ...c, selected: !allSelected }
      }
      return c
    }))
  }

  // Seçili öğe sayıları
  const selectedUsers = users.filter(u => u.selected)
  const selectedComments = comments.filter(c => c.selected)

  // Toplu ban işlemi
  const bulkBanUsers = async () => {
    if (!user || selectedUsers.length === 0) return
    
    setProcessing(true)
    try {
      const batch = writeBatch(db)
      const userIds: string[] = []
      
      for (const u of selectedUsers) {
        const userRef = doc(db, 'users', u.id)
        batch.update(userRef, { status: 'banned' })
        userIds.push(u.id)
      }
      
      await batch.commit()
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'bulk_action',
        'user',
        'multiple',
        {
          action: 'bulk_ban',
          userIds,
          count: userIds.length,
        }
      )
      
      // State güncelle
      setUsers(prev => prev.map(u => 
        selectedUsers.find(su => su.id === u.id) 
          ? { ...u, status: 'banned', selected: false } 
          : u
      ))
      
      setShowConfirmModal(false)
    } catch (error) {
      console.error('Toplu ban hatası:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Toplu unban işlemi
  const bulkUnbanUsers = async () => {
    if (!user || selectedUsers.length === 0) return
    
    setProcessing(true)
    try {
      const batch = writeBatch(db)
      const userIds: string[] = []
      
      for (const u of selectedUsers) {
        const userRef = doc(db, 'users', u.id)
        batch.update(userRef, { status: 'active' })
        userIds.push(u.id)
      }
      
      await batch.commit()
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'bulk_action',
        'user',
        'multiple',
        {
          action: 'bulk_unban',
          userIds,
          count: userIds.length,
        }
      )
      
      // State güncelle
      setUsers(prev => prev.map(u => 
        selectedUsers.find(su => su.id === u.id) 
          ? { ...u, status: 'active', selected: false } 
          : u
      ))
      
      setShowConfirmModal(false)
    } catch (error) {
      console.error('Toplu unban hatası:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Toplu yorum silme işlemi
  const bulkDeleteComments = async () => {
    if (!user || selectedComments.length === 0) return
    
    setProcessing(true)
    try {
      const batch = writeBatch(db)
      const commentIds: string[] = []
      const commentDetails: Array<{ id: string; content: string; userName: string }> = []
      
      for (const c of selectedComments) {
        const commentRef = doc(db, 'comments', c.id)
        batch.delete(commentRef)
        commentIds.push(c.id)
        commentDetails.push({
          id: c.id,
          content: c.content.substring(0, 50),
          userName: c.userName,
        })
      }
      
      await batch.commit()
      
      // Audit log oluştur
      await createAuditLog(
        user.uid,
        user.displayName || 'Admin',
        'bulk_action',
        'comment',
        'multiple',
        {
          action: 'bulk_delete',
          commentIds,
          count: commentIds.length,
          comments: commentDetails,
        }
      )
      
      // State güncelle
      setComments(prev => prev.filter(c => !selectedComments.find(sc => sc.id === c.id)))
      
      setShowConfirmModal(false)
    } catch (error) {
      console.error('Toplu silme hatası:', error)
    } finally {
      setProcessing(false)
    }
  }

  // Onay modalını aç
  const openConfirmModal = (type: 'ban' | 'unban' | 'delete') => {
    let count = 0
    let onConfirm: () => Promise<void>
    
    if (type === 'ban') {
      count = selectedUsers.length
      onConfirm = bulkBanUsers
    } else if (type === 'unban') {
      count = selectedUsers.length
      onConfirm = bulkUnbanUsers
    } else {
      count = selectedComments.length
      onConfirm = bulkDeleteComments
    }
    
    setConfirmAction({ type, count, onConfirm })
    setShowConfirmModal(true)
  }

  // Filtreleme
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  })

  const filteredComments = comments.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.content.toLowerCase().includes(q) ||
      c.userName?.toLowerCase().includes(q)
    )
  })

  // Loading durumları
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    router.push('/giris')
    return null
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Icons.shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erişim Engellendi</h1>
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    )
  }

  const tabs = [
    { id: 'users' as TabType, label: 'Kullanıcılar', icon: Users },
    { id: 'comments' as TabType, label: 'Yorumlar', icon: MessageCircle },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <Icons.chevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Toplu İşlemler</h1>
              <p className="text-muted-foreground text-sm">Birden fazla öğe üzerinde işlem yapın</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setSearchQuery('')
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Arama ve Aksiyonlar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 md:max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={activeTab === 'users' ? 'Kullanıcı ara...' : 'Yorum ara...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          
          {/* Toplu İşlem Butonları */}
          {activeTab === 'users' && selectedUsers.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => openConfirmModal('ban')}
                disabled={processing}
              >
                <Ban className="h-4 w-4 mr-2" />
                Toplu Yasakla ({selectedUsers.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => openConfirmModal('unban')}
                disabled={processing}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Yasağı Kaldır ({selectedUsers.length})
              </Button>
            </div>
          )}
          
          {activeTab === 'comments' && selectedComments.length > 0 && (
            <Button
              variant="destructive"
              onClick={() => openConfirmModal('delete')}
              disabled={processing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Toplu Sil ({selectedComments.length})
            </Button>
          )}
        </div>

        {/* İçerik */}
        {dataLoading ? (
          <div className="flex justify-center py-12">
            <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Kullanıcılar Tab */}
            {activeTab === 'users' && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4 w-12">
                        <button
                          onClick={selectAllUsers}
                          className="flex items-center justify-center"
                        >
                          {filteredUsers.length > 0 && filteredUsers.every(u => u.selected) ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                      </th>
                      <th className="text-left p-4">Kullanıcı</th>
                      <th className="text-left p-4">E-posta</th>
                      <th className="text-left p-4">Durum</th>
                      <th className="text-left p-4">Kayıt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr 
                        key={u.id} 
                        className={cn(
                          'border-t border-border cursor-pointer transition-colors',
                          u.selected && 'bg-primary/5'
                        )}
                        onClick={() => toggleUserSelection(u.id)}
                      >
                        <td className="p-4">
                          {u.selected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Icons.user className="h-4 w-4" />
                              </div>
                            )}
                            <span>{u.displayName || 'Anonim'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{u.email}</td>
                        <td className="p-4">
                          <span className={cn(
                            'px-2 py-1 rounded text-xs',
                            u.status === 'banned' 
                              ? 'bg-red-500/10 text-red-500' 
                              : 'bg-green-500/10 text-green-500'
                          )}>
                            {u.status === 'banned' ? 'Yasaklı' : 'Aktif'}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground text-sm">
                          {u.createdAt.toLocaleDateString('tr-TR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Kullanıcı bulunamadı</p>
                  </div>
                )}
              </div>
            )}

            {/* Yorumlar Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-3">
                {/* Tümünü Seç */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={selectAllComments}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {filteredComments.length > 0 && filteredComments.every(c => c.selected) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                    Tümünü Seç
                  </button>
                </div>
                
                {filteredComments.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => toggleCommentSelection(c.id)}
                    className={cn(
                      'bg-card border rounded-xl p-4 cursor-pointer transition-all',
                      c.selected && 'border-primary bg-primary/5'
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        {c.selected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{c.userName}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.mediaType} #{c.mediaId}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {c.createdAt.toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{c.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredComments.length === 0 && (
                  <div className="text-center py-12">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Yorum bulunamadı</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Onay Modalı */}
        {showConfirmModal && confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card border border-border rounded-xl w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {confirmAction.type === 'ban' && 'Toplu Yasaklama'}
                      {confirmAction.type === 'unban' && 'Toplu Yasak Kaldırma'}
                      {confirmAction.type === 'delete' && 'Toplu Silme'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Bu işlem geri alınamaz
                    </p>
                  </div>
                </div>
                
                <p className="text-sm mb-6">
                  {confirmAction.type === 'ban' && (
                    <>
                      <strong>{confirmAction.count}</strong> kullanıcıyı yasaklamak istediğinizden emin misiniz?
                    </>
                  )}
                  {confirmAction.type === 'unban' && (
                    <>
                      <strong>{confirmAction.count}</strong> kullanıcının yasağını kaldırmak istediğinizden emin misiniz?
                    </>
                  )}
                  {confirmAction.type === 'delete' && (
                    <>
                      <strong>{confirmAction.count}</strong> yorumu kalıcı olarak silmek istediğinizden emin misiniz?
                    </>
                  )}
                </p>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={processing}
                  >
                    İptal
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={confirmAction.onConfirm}
                    disabled={processing}
                  >
                    {processing ? (
                      <Icons.spinner className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {confirmAction.type === 'ban' && 'Yasakla'}
                    {confirmAction.type === 'unban' && 'Yasağı Kaldır'}
                    {confirmAction.type === 'delete' && 'Sil'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
