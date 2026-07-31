'use client'

import { useState, useEffect } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { collection, getDocs, query, limit, orderBy, startAfter, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { toast } from 'sonner'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserRole, ROLE_INFO } from '@/lib/roles'

interface UserData {
    id: string
    email?: string
    username?: string
    displayName?: string
    photoURL?: string
    role?: UserRole
    createdAt?: any
}

export default function ModUsersPage() {
    const [users, setUsers] = useState<UserData[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Edit Modal State
    const [editingUser, setEditingUser] = useState<UserData | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [selectedRole, setSelectedRole] = useState<string>('user')
    const [updating, setUpdating] = useState(false)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const q = query(collection(db, 'users'), limit(50))
            const snapshot = await getDocs(q)
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as UserData[]
            setUsers(fetchedUsers)
        } catch (error) {
            console.error('Error fetching users:', error)
            toast.error('Kullanıcılar yüklenirken hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const handleEditClick = (user: UserData) => {
        setEditingUser(user)
        setSelectedRole(user.role || 'user')
        setIsEditModalOpen(true)
    }

    const handleRoleUpdate = async () => {
        if (!editingUser) return
        setUpdating(true)
        try {
            // 1. Update user document
            const userRef = doc(db, 'users', editingUser.id)
            await updateDoc(userRef, { role: selectedRole })

            // 2. Handle roles collection
            const roleRef = doc(db, 'roles', editingUser.id)
            if (['moderator', 'admin', 'founder'].includes(selectedRole)) {
                await setDoc(roleRef, {
                    role: selectedRole,
                    updatedAt: new Date()
                })
            } else {
                // Normal kullanıcıya düşür
                try {
                    await deleteDoc(roleRef)
                } catch (e) {
                    console.log('Rol silinirken hata:', e)
                }
            }

            toast.success('Kullanıcı rolü güncellendi')
            setIsEditModalOpen(false)
            fetchUsers() // Listeyi yenile
        } catch (error) {
            console.error('Update failed:', error)
            toast.error('Güncelleme başarısız: Yetkiniz olmayabilir.')
        } finally {
            setUpdating(false)
        }
    }

    const filteredUsers = users.filter(user =>
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.id.includes(searchTerm))
    )

    return (
        <div className="space-y-6">

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
                    <p className="text-white/50">Toplam {users.length}+ kullanıcı görüntüleniyor</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
                        <Input
                            placeholder="Email, isim veya ID ile ara..."
                            className="pl-9 bg-[#151515] border-white/10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={fetchUsers} variant="secondary">
                        <Icons.refresh className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="bg-[#151515] border border-white/5 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/40 uppercase tracking-wider">
                    <div className="col-span-4">Kullanıcı</div>
                    <div className="col-span-4">Email / ID</div>
                    <div className="col-span-2">Rol</div>
                    <div className="col-span-2 text-right">İşlemler</div>
                </div>

                <div className="divide-y divide-white/5">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            Kullanıcı bulunamadı.
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <div key={user.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition-colors">
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden relative">
                                        {user.photoURL ? (
                                            <Image src={user.photoURL} alt={user.displayName || '?'} fill className="object-cover" sizes="40px" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/50 font-bold">
                                                {(user.displayName || user.email || 'U')[0].toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-sm">{user.displayName || 'İsimsiz Kullanıcı'}</h3>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-white/50">
                                                ID: {user.id.slice(0, 6)}...
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-4 text-sm text-white/60 truncate">
                                    {user.email || '-'}
                                </div>

                                <div className="col-span-2">
                                    {user.role && ROLE_INFO[user.role as UserRole] ? (
                                        <span className={cn(
                                            "text-xs px-2 py-1 rounded-full font-bold border inline-flex items-center gap-1",
                                            user.role === 'founder' ? "bg-orange-600/20 text-orange-500 border-orange-500/20" :
                                                user.role === 'admin' ? "bg-orange-500/20 text-orange-400 border-orange-500/20" :
                                                    user.role === 'moderator' ? "bg-purple-500/20 text-purple-400 border-purple-500/20" :
                                                        "bg-white/5 text-white/50 border-white/5"
                                        )}>
                                            <span>{ROLE_INFO[user.role as UserRole].emoji}</span>
                                            {ROLE_INFO[user.role as UserRole].label}
                                        </span>
                                    ) : (
                                        <span className="text-xs px-2 py-1 rounded-full font-bold border bg-white/5 text-white/50 border-white/5">
                                            👤 Standart Üye
                                        </span>
                                    )}
                                </div>

                                <div className="col-span-2 flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 hover:bg-white/10"
                                        onClick={() => handleEditClick(user)}
                                    >
                                        <Icons.edit className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10">
                                        <Icons.ban className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="bg-[#1A1A1A] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Kullanıcı Düzenle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Kullanıcı Rolü</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue placeholder="Rol seçin" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#1A1A1A] border-white/10 text-white">
                                    <SelectItem value="user">👤 Kullanıcı</SelectItem>
                                    <SelectItem value="moderator">🛡️ Moderatör</SelectItem>
                                    <SelectItem value="admin">⚙️ Yönetici</SelectItem>
                                    <SelectItem value="founder">👑 Kurucu</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-white/50">
                                Mod paneline erişim: Çırak ve üstü. Kurucu: Tüm yetkiler. Diğerleri: Kısıtlamalar var.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsEditModalOpen(false)}
                            className="text-white/50 hover:text-white"
                        >
                            İptal
                        </Button>
                        <Button
                            onClick={handleRoleUpdate}
                            disabled={updating}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {updating && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                            Değişiklikleri Kaydet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
