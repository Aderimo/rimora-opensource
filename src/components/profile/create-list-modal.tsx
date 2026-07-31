'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { createCustomList, CustomList } from '@/lib/user-lists'

interface CreateListModalProps {
    userId: string
    isOpen: boolean
    onClose: () => void
    onListCreated: (list: CustomList) => void
}

export function CreateListModal({ userId, isOpen, onClose, onListCreated }: CreateListModalProps) {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        try {
            const newList = await createCustomList(userId, name)
            onListCreated(newList)
            onClose()
            setName('')
        } catch (error) {
            console.error('Failed to create list', error)
            alert('Liste oluşturulurken bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Yeni Liste Oluştur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} disabled={loading}>
                        <Icons.close className="h-5 w-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="listName" className="text-sm font-medium text-muted-foreground">
                            Liste Adı
                        </label>
                        <input
                            id="listName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Örn: Hafta sonu izlenecekler"
                            className="w-full h-10 px-3 rounded-lg bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            İptal
                        </Button>
                        <Button type="submit" disabled={!name.trim() || loading} className="min-w-[100px]">
                            {loading ? <Icons.spinner className="h-4 w-4 animate-spin" /> : 'Oluştur'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
