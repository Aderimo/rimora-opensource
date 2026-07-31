'use client'

import { useState } from 'react'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { updateCustomList, deleteCustomList } from '@/lib/user-lists'
import { toast } from 'sonner'
import type { CustomList } from '@/lib/user-lists'

interface EditListModalProps {
    list: CustomList
    isOpen: boolean
    onClose: () => void
    onUpdate: (updatedList: CustomList) => void
    onDelete: (listId: string) => void
}

export function EditListModal({ list, isOpen, onClose, onUpdate, onDelete }: EditListModalProps) {
    const [name, setName] = useState(list.name)
    const [isPublic, setIsPublic] = useState(list.isPublic || false)
    const [loading, setLoading] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const handleUpdate = async () => {
        if (!name.trim()) return

        setLoading(true)
        try {
            await updateCustomList(list.id, { name, isPublic })
            onUpdate({ ...list, name, isPublic })
            toast.success('Liste güncellendi')
            onClose()
        } catch (error) {
            console.error(error)
            toast.error('Güncelleme başarısız')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Bu listeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return

        setDeleting(true)
        try {
            await deleteCustomList(list.id)
            onDelete(list.id)
            toast.success('Liste silindi')
            onClose()
        } catch (error) {
            console.error(error)
            toast.error('Silme işlemi başarısız')
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#1A1A1A] border-white/10 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Listeyi Düzenle</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Liste Adı</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-white/5 border-white/10"
                            placeholder="Örn: En İyi Komediler"
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                        <div className="space-y-0.5">
                            <Label className="text-base">Herkese Açık</Label>
                            <p className="text-xs text-white/50">
                                Bu listeyi diğer kullanıcılar profilinizde ve keşfet sayfasında görebilir.
                            </p>
                        </div>
                        <Switch
                            checked={isPublic}
                            onCheckedChange={setIsPublic}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <div className="flex w-full justify-between">
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting || loading}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20"
                        >
                            {deleting ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <Icons.trash className="h-4 w-4 mr-2" />}
                            Listeyi Sil
                        </Button>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={onClose} disabled={loading}>
                                İptal
                            </Button>
                            <Button onClick={handleUpdate} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                                {loading && <Icons.spinner className="h-4 w-4 animate-spin mr-2" />}
                                Kaydet
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
