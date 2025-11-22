import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function getProductivityColor(score: number): string {
    if (score >= 80) return 'text-earth-tan'
    if (score >= 60) return 'text-status-success'
    if (score >= 40) return 'text-status-warning'
    return 'text-status-error'
}

export function getProductivityBgColor(score: number): string {
    if (score >= 80) return 'bg-earth-tan/20'
    if (score >= 60) return 'bg-status-success/20'
    if (score >= 40) return 'bg-status-warning/20'
    return 'bg-status-error/20'
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function getDaysUntil(timestamp: number): number {
    const now = Date.now()
    const target = timestamp * 1000
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}
