export interface QuickStats {
    focusPercentage: number
    contextSwitches: number
    focusedTime: string
    activeGoals: number
    peakHour: string
    currentDay: string
}

export interface ActivityData {
    hour: number
    productivity: number
}

export interface Session {
    id: number
    project: string
    sessionType: string
    duration: number
    productivity: number
    startTime: number
}

export interface Habit {
    name: string
    description: string
    currentStreak: number
    longestStreak: number
    consistency7d: number
    consistency30d: number
}

export interface Goal {
    id: number
    goalText: string
    keywords: string[]
    targetDate?: number
    progress: number
    alignmentPercentage: number
    status: 'active' | 'paused' | 'completed'
}

export interface Prediction {
    predictedScore: number
    confidence: number
    reasoning: string
}

export interface Pattern {
    apps: string[]
    avgProductivity: number
    frequency: number
}

export interface Blocker {
    pattern: string
    impact: string
    suggestion: string
}

export interface Notification {
    type: string
    urgency: 'high' | 'medium' | 'low' | 'none'
    message: string
}
