import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { themes } from '@/utils/themes'
import type { ThemeName } from '@/utils/themes'

interface ThemeContextType {
    currentTheme: ThemeName
    setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
        const saved = localStorage.getItem('kryptictrack-theme')
        return (saved as ThemeName) || 'sunset'  // Changed default to sunset
    })

    useEffect(() => {
        const theme = themes[currentTheme]
        const root = document.documentElement

        root.style.setProperty('--color-bg', theme.colors.bg)
        root.style.setProperty('--color-bg-secondary', theme.colors.bgSecondary)
        root.style.setProperty('--color-accent', theme.colors.accent)
        root.style.setProperty('--color-text', theme.colors.text)
        root.style.setProperty('--color-text-muted', theme.colors.textMuted)

        localStorage.setItem('kryptictrack-theme', currentTheme)
    }, [currentTheme])

    const setTheme = (theme: ThemeName) => {
        setCurrentTheme(theme)
    }

    return (
        <ThemeContext.Provider value={{ currentTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return context
}
