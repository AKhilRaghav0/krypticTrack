export const themes = {
    earthy: {
        name: 'Earthy',
        colors: {
            bg: '#2C3930',
            bgSecondary: '#3F4F44',
            accent: '#A27B5C',
            text: '#DCD7C9',
            textMuted: '#A0998A',
        },
    },
    slate: {
        name: 'Slate',
        colors: {
            bg: '#1e293b',
            bgSecondary: '#334155',
            accent: '#64748b',
            text: '#f1f5f9',
            textMuted: '#94a3b8',
        },
    },
    dark: {
        name: 'Dark',
        colors: {
            bg: '#0a0a0a',
            bgSecondary: '#1a1a1a',
            accent: '#666666',
            text: '#ffffff',
            textMuted: '#888888',
        },
    },
    ocean: {
        name: 'Ocean',
        colors: {
            bg: '#1a2332',
            bgSecondary: '#2a3f5f',
            accent: '#4a9eff',
            text: '#e0f2fe',
            textMuted: '#7dd3fc',
        },
    },
    sunset: {
        name: 'Sunset',
        colors: {
            bg: '#2d1b2e',
            bgSecondary: '#4a2545',
            accent: '#ff6b9d',
            text: '#fde2e4',
            textMuted: '#ffc2d1',
        },
    },
    forest: {
        name: 'Forest',
        colors: {
            bg: '#1a2f1a',
            bgSecondary: '#2d4a2d',
            accent: '#5fb55f',
            text: '#e8f5e8',
            textMuted: '#a8d5a8',
        },
    },
} as const

export type ThemeName = 'earthy' | 'slate' | 'dark' | 'ocean' | 'sunset' | 'forest'
