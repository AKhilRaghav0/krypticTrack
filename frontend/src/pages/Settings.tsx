import { Gear, Palette } from '@phosphor-icons/react'
import { useTheme } from '@/contexts/ThemeContext'
import { themes } from '@/utils/themes'
import type { ThemeName } from '@/utils/themes'

export function Settings() {
    const { currentTheme, setTheme } = useTheme()

    return (
        <div className="min-h-screen bg-[var(--color-bg)] p-8">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-20" />

            <div className="relative z-10 max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold font-mono text-[var(--color-text)] mb-2">
                        Settings
                    </h1>
                    <p className="text-[var(--color-text-muted)] font-mono">
                        Configure your productivity tracker
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Theme Selector */}
                    <div className="bg-[var(--color-bg-secondary)]/70 backdrop-blur-sm border border-[var(--color-text-muted)]/10 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Palette size={24} weight="bold" className="text-[var(--color-accent)]" />
                            <h3 className="text-xl font-bold font-mono text-[var(--color-text)]">
                                Theme
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {(Object.keys(themes) as ThemeName[]).map((themeName) => {
                                const theme = themes[themeName]
                                const isActive = currentTheme === themeName

                                return (
                                    <button
                                        key={themeName}
                                        onClick={() => setTheme(themeName)}
                                        className={`relative p-4 rounded-lg border-2 transition-all ${isActive
                                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                            : 'border-[var(--color-text-muted)]/20 hover:border-[var(--color-text-muted)]/40'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex gap-1">
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: theme.colors.bg }}
                                                />
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: theme.colors.bgSecondary }}
                                                />
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: theme.colors.accent }}
                                                />
                                            </div>
                                        </div>
                                        <p className="font-mono font-semibold text-[var(--color-text)] text-sm">
                                            {theme.name}
                                        </p>
                                        {isActive && (
                                            <div className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-accent)] rounded-full" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* General Settings */}
                    <div className="bg-[var(--color-bg-secondary)]/70 backdrop-blur-sm border border-[var(--color-text-muted)]/10 rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Gear size={24} weight="bold" className="text-[var(--color-accent)]" />
                            <h3 className="text-xl font-bold font-mono text-[var(--color-text)]">
                                General
                            </h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-mono text-[var(--color-text)] font-semibold">Auto-refresh</p>
                                    <p className="font-mono text-[var(--color-text-muted)] text-sm">
                                        Update dashboard automatically
                                    </p>
                                </div>
                                <div className="w-12 h-6 bg-[var(--color-accent)] rounded-full cursor-pointer" />
                            </div>
                        </div>
                    </div>

                    {/* About */}
                    <div className="bg-[var(--color-bg-secondary)]/70 backdrop-blur-sm border border-[var(--color-text-muted)]/10 rounded-xl p-6">
                        <h3 className="text-xl font-bold font-mono text-[var(--color-text)] mb-4">
                            About
                        </h3>
                        <div className="space-y-2 text-[var(--color-text-muted)] font-mono text-sm">
                            <p>KrypticTrack v1.0.0</p>
                            <p>Your productivity brain, visualized</p>
                            <p className="pt-2 text-[var(--color-text-muted)]/70 text-xs">
                                Built with React, TypeScript, TailwindCSS
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
