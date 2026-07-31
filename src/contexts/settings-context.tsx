'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Cookies from 'js-cookie'

interface SettingsContextType {
    showAdultContent: boolean
    setShowAdultContent: (show: boolean) => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

interface SettingsProviderProps {
  children: React.ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
    const [showAdultContent, setShowAdultContent] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Load from cookie on mount
        const saved = Cookies.get('rimora-adult-content')
        if (saved) {
            setShowAdultContent(saved === 'true')
        }
        setLoading(false)
    }, [])

    const toggleAdultContent = (show: boolean) => {
        setShowAdultContent(show)
        // 365 days expiry
        Cookies.set('rimora-adult-content', String(show), { expires: 365, sameSite: 'strict' })
    }

    return (
        <SettingsContext.Provider
            value={{
                showAdultContent,
                setShowAdultContent: toggleAdultContent
            }}
        >
            {!loading && children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}
