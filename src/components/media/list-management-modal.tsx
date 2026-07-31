'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/components/ui/toast'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    getMediaListStatus,
    getCustomLists,
    toggleListItem,
    createCustomList,
    type CustomList
} from '@/lib/user-lists'
import type { MediaType } from '@/types'

interface ListManagementModalProps {
    isOpen: boolean
    onClose: () => void
    mediaId: number
    mediaType: MediaType
    title: string
    posterPath: string | null
}

export function ListManagementModal({
    isOpen,
    onClose,
    mediaId,
    mediaType,
    title,
    posterPath
}: ListManagementModalProps) {
    const { user } = useAuth()
    const { addToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)

    // Varsayılan listeler
    const [defaultLists, setDefaultLists] = useState({
        watchlist: false,
        favorites: false,
        watched: false
    })

    // Özel listeler ve hangilerine ekli olduğu
    const [customLists, setCustomLists] = useState<CustomList[]>([])
    const [membership, setMembership] = useState<string[]>([])

    // Yeni liste oluşturma
    const [newListName, setNewListName] = useState('')
    const [isCreating, setIsCreating] = useState(false)

    // Verileri yükle 
    useEffect(() => {
        if (isOpen && user) {
            setLoading(true)
            Promise.all([
                getMediaListStatus(user.uid, mediaId, mediaType),
                getCustomLists(user.uid)
            ]).then(([status, lists]) => {
                setDefaultLists(status)
                setCustomLists(lists)
                // Burada custom list üyeliklerini kontrol etmemiz lazım ama 
                // getMediaListStatus şu an sadece default'ları dönüyor gibi görünüyor.
                // Bu yüzden her bir custom list için kontrol etmeliyiz veya API'yi güncellemeliyiz.
                // Şimdilik list üyeliği bilgisini client-side'da tutan bir yapı olmadığını varsayarak
                // basitçe membership array'ini yönetiyoruz. 
                // NOT: İdealde getMediaListStatus tüm üyelikleri dönmeli. 
                // Mevcut yapıda her liste için tek tek kontrol etmek pahalı olabilir.
                // Optimistik UI ile devam edeceğiz.
            }).catch(console.error)
                .finally(() => setLoading(false))
        }
    }, [isOpen, user, mediaId, mediaType])

    // Özel liste üyeliklerini ayrıca kontrol et (API kısıtı varsa)
    // Bu örnekte API call sayısını düşürmek için lazy loading veya 
    // tek seferde alma mantığı kurulmalı. Şimdilik varsayılan davranışa güveniyoruz.

    const handleToggle = async (listSlug: string, isCustom: boolean) => {
        if (!user) return

        setProcessing(listSlug)
        try {
            const added = await toggleListItem(user.uid, mediaId, mediaType, listSlug, title, posterPath)

            if (isCustom) {
                if (added) {
                    setMembership(prev => [...prev, listSlug])
                } else {
                    setMembership(prev => prev.filter(s => s !== listSlug))
                }
            } else {
                setDefaultLists(prev => ({ ...prev, [listSlug]: added }))
            }

            addToast(added ? 'Listeye eklendi' : 'Listeden çıkarıldı', 'success')
        } catch (error) {
            addToast('İşlem başarısız', 'error')
        } finally {
            setProcessing(null)
        }
    }

    const handleCreateList = async () => {
        if (!user || !newListName.trim()) return

        setIsCreating(true)
        try {
            const newList = await createCustomList(user.uid, newListName)
            setCustomLists(prev => [newList, ...prev])
            setNewListName('')

            // Yeni listeye otomatik ekle
            await handleToggle(newList.slug, true)

            addToast('Yeni liste oluşturuldu ve eklendi', 'success')
        } catch (error) {
            addToast('Liste oluşturulamadı', 'error')
        } finally {
            setIsCreating(false)
        }
    }

    // Özel liste kontrolü için useEffect
    useEffect(() => {
        if (user && customLists.length > 0) {
            // Bu kısım normalde backend'den "memberOf" array dönseydi gerekmezdi.
            // Her listede var mı yok mu kontrolü biraz maliyetli ama mecbur.
            // Hepsini paralel kontrol edelim.
            // "getMediaListStatus" fonksiyonunun custom listeleri de kapsaması daha doğru olurdu (API refactor gerekebilir).
            // Şimdilik sadece tıklanınca toggle çalıştığı için, ilk açılışta 
            // doğru state'i göstermek adına "sanki ekli değilmiş gibi" başlatıp
            // kullanıcı tıkladığında ekliyoruz. Veya getMediaMembership fonksiyonu varsa onu kullanırız.
            // list-buttons.tsx'de getMediaMembership kullanılmış! Harika.

            import('@/lib/user-lists').then(({ getMediaMembership }) => {
                getMediaMembership(user.uid, mediaId, mediaType).then(members => {
                    setMembership(members)
                })
            })
        }
    }, [user, customLists, mediaId, mediaType])


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-black/95 border-white/10 text-white p-0 overflow-hidden gap-0">
                <DialogHeader className="p-4 border-b border-white/10">
                    <DialogTitle>Listeye Ekle</DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    {/* Yeni Liste Oluşturma */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Yeni liste adı..."
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            className="bg-white/5 border-white/10 focus:border-primary/50"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                        />
                        <Button
                            onClick={handleCreateList}
                            disabled={!newListName.trim() || isCreating}
                            className="shrink-0"
                        >
                            {isCreating ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <Icons.plus className="h-4 w-4" />}
                        </Button>
                    </div>

                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-4">
                            {/* Varsayılan Listeler */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Varsayılan Listeler</Label>

                                <div className="space-y-2">
                                    <Label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                                        <Checkbox
                                            checked={defaultLists.watchlist}
                                            onCheckedChange={() => handleToggle('watchlist', false)}
                                            disabled={processing === 'watchlist'}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="p-1.5 rounded-md bg-blue-500/20 text-blue-400">
                                                <Icons.clock className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">İzlenecekler</span>
                                        </div>
                                        {processing === 'watchlist' && <Icons.spinner className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    </Label>

                                    <Label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                                        <Checkbox
                                            checked={defaultLists.favorites}
                                            onCheckedChange={() => handleToggle('favorites', false)}
                                            disabled={processing === 'favorites'}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="p-1.5 rounded-md bg-pink-500/20 text-pink-400">
                                                <Icons.heart className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">Favoriler</span>
                                        </div>
                                        {processing === 'favorites' && <Icons.spinner className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    </Label>

                                    <Label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                                        <Checkbox
                                            checked={defaultLists.watched}
                                            onCheckedChange={() => handleToggle('watched', false)}
                                            disabled={processing === 'watched'}
                                        />
                                        <div className="flex items-center gap-3 flex-1">
                                            <div className="p-1.5 rounded-md bg-green-500/20 text-green-400">
                                                <Icons.check className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">İzlendi</span>
                                        </div>
                                        {processing === 'watched' && <Icons.spinner className="h-3 w-3 animate-spin text-muted-foreground" />}
                                    </Label>
                                </div>
                            </div>

                            {/* Özel Listeler */}
                            {customLists.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Özel Listelerim</Label>
                                    <div className="space-y-2">
                                        {customLists.map(list => (
                                            <Label key={list.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                                                <Checkbox
                                                    checked={membership.includes(list.slug)}
                                                    onCheckedChange={() => handleToggle(list.slug, true)}
                                                    disabled={processing === list.slug}
                                                />
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400">
                                                        <Icons.list className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-medium">{list.name}</span>
                                                </div>
                                                {processing === list.slug && <Icons.spinner className="h-3 w-3 animate-spin text-muted-foreground" />}
                                            </Label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end">
                    <Button variant="ghost" onClick={onClose} className="hover:bg-white/10">Tamam</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
