import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    timeout: 10000,
})

// Quick Stats
export const getQuickStats = async () => {
    const { data } = await api.get('/stats/quick')
    return data
}

// Activity
export const getActivityChart = async (date?: string) => {
    const { data } = await api.get('/stats/activity', { params: { date } })
    return data
}

// Heatmap
export const getHeatmap = async (days: number = 7) => {
    const { data } = await api.get('/stats/heatmap', { params: { days } })
    return data
}

// Sessions
export const getSessions = async (startDate?: string, endDate?: string) => {
    const { data } = await api.get('/sessions', { params: { startDate, endDate } })
    return data
}

// Habits
export const getHabits = async () => {
    const { data } = await api.get('/habits')
    return data
}

export const getHabitCalendar = async (name: string) => {
    const { data } = await api.get(`/habits/${name}/calendar`)
    return data
}

// Goals
export const getActiveGoals = async () => {
    const { data } = await api.get('/goals')
    return data
}

// Insights
export const getPredictions = async () => {
    const { data } = await api.get('/insights/predictions')
    return data
}

export const getPatterns = async () => {
    const { data } = await api.get('/insights/patterns')
    return data
}

export const getBlockers = async () => {
    const { data } = await api.get('/insights/blockers')
    return data
}

// Notifications
export const getNotifications = async () => {
    const { data } = await api.get('/notifications')
    return data
}

export default api
