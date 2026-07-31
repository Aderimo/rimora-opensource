'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getUserRole, canAccessModPanel, ROLE_INFO } from '@/lib/roles'
import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModLayoutProps {
  children: React.ReactNode
}

export default function ModLayout({ children }: ModLayoutProps) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)
    const [userRole, setUserRole] = useState('')

    useEffect(() => {
        const checkAuth = async () => {
            if (loading) return

            if (!user) {
                router.push('/giris')
                return
            }

            try {
                const role = await getUserRole(user.uid, user.email || undefined)
                setUserRole(role)
                
                if (canAccessModPanel(role)) {
                    setIsAuthorized(true)
                } else {
                    router.push('/')
                }
            } catch (error) {
                router.push('/')
            } finally {
                setChecking(false)
            }
        }

        checkAuth()
    }, [user, loading, router])

    if (loading || checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
                <Icons.spinner className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        )
    }

    if (!isAuthorized) return null

    const menuItems = [
        { href: '/mod', label: 'Mod Yönetimi', icon: Icons.dashboard },
        { href: '/mod/stats', label: 'Rol İstatistikleri', icon: Icons.chart },
        { href: '/mod/logs', label: 'Aktivite Logu', icon: Icons.activity },
        { href: '/mod/warnings', label: 'Uyarı & Ceza', icon: Icons.alertTriangle },
        { href: '/mod/penalties', label: 'Ceza Sorgulama', icon: Icons.search },
        { href: '/mod/auto-penalties', label: 'Otomatik Ceza Logu', icon: Icons.zap },
        { href: '/mod/bulk-actions', label: 'Toplu İşlemler', icon: Icons.layers },
        { href: '/mod/reports', label: 'Raporlar', icon: Icons.flag },
        { href: '/mod/users', label: 'Kullanıcılar', icon: Icons.users },
        { href: '/mod/feedback', label: 'Destek & Bildirim', icon: Icons.messageSquare },
    ]

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#111] flex flex-col fixed h-full z-50">
                <div className="p-6 border-b border-white/5">
                    <Link href="/mod" className="flex items-center gap-2">
                        <div className="p-2 bg-purple-600 rounded-lg">
                            <Icons.shield className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">Mod Paneli</h1>
                            <p className="text-xs text-white/50">
                                {userRole && ROLE_INFO[userRole as keyof typeof ROLE_INFO]
                                    ? `${ROLE_INFO[userRole as keyof typeof ROLE_INFO].emoji} ${ROLE_INFO[userRole as keyof typeof ROLE_INFO].label}`
                                    : 'Moderator'
                                }
                            </p>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-12 text-base font-normal",
                                    pathname === item.href
                                        ? "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300"
                                        : "text-white/70 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <Link href="/">
                        <Button variant="ghost" className="w-full gap-2 text-white/50 hover:text-white">
                            <Icons.arrowLeft className="h-4 w-4" />
                            Ana Sayfa
                        </Button>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    )
}
