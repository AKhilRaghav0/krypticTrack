import useSWR from 'swr'
import { Target, Swap, CheckCircle, Flame } from '@phosphor-icons/react'
import { StatCard } from '@/components/StatCard'
import { ActivityChart } from '@/components/ActivityChart'
import { RecentSessions } from '@/components/RecentSessions'
import { ProductivityHeatmap } from '@/components/ProductivityHeatmap'
import { getQuickStats, getSessions, getActivityChart } from '@/services/api'
import type { QuickStats, Session, ActivityData } from '@/types'

export function Dashboard() {
    const { data: stats } = useSWR<QuickStats>('/stats', getQuickStats, { refreshInterval: 5000 })
    const { data: sessions } = useSWR<Session[]>('/sessions', getSessions, { refreshInterval: 30000 })
    const { data: activity } = useSWR<ActivityData[]>('/stats/activity', getActivityChart, { refreshInterval: 60000 })

    const isLoading = !stats

    if (isLoading) {
        return (
            <div className="min-h-screen bg-forest-dark flex items-center justify-center">
                <div className="text-earth-cream font-mono text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-forest-dark p-8">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#3F4F4410_1px,transparent_1px),linear-gradient(to_bottom,#3F4F4410_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-20" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold font-mono text-earth-cream mb-2">
                            🧠 KrypticTrack Dashboard
                        </h1>
                        <p className="text-earth-cream/60 font-mono">
                            Your productivity brain, visualized
                        </p>
                    </div>

                    <div className="text-right font-mono text-earth-cream/70 text-sm">
                        <div>{stats?.currentDay || 'Loading...'}</div>
                        <div className="text-earth-cream">{new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Focus Time"
                        value={stats?.focusPercentage?.toFixed(0) + '%' || '0%'}
                        icon={<Target weight="bold" />}
                    />

                    <StatCard
                        label="Context Switches"
                        value={stats?.contextSwitches || 0}
                        icon={<Swap weight="bold" />}
                        trend={-15}
                    />

                    <StatCard
                        label="Focused Duration"
                        value={stats?.focusedTime || '0m'}
                        icon={<CheckCircle weight="bold" />}
                    />

                    <StatCard
                        label="Active Goals"
                        value={stats?.activeGoals || 0}
                        icon={<Flame weight="bold" />}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[350px]">
                    <div className="lg:col-span-2 h-full">
                        <ActivityChart data={activity} />
                    </div>
                    <div className="h-full">
                        <RecentSessions sessions={sessions} />
                    </div>
                </div>

                {stats?.peakHour && (
                    <div className="gradient-warm grain rounded-xl p-6">
                        <div className="text-center">
                            <p className="text-earth-cream/70 font-mono text-sm mb-2">
                                Your Peak Productivity Hour
                            </p>
                            <p className="text-3xl font-bold font-mono text-forest-dark">
                                {stats.peakHour}
                            </p>
                        </div>
                    </div>
                )}

                {/* Productivity Heatmap */}
                <ProductivityHeatmap />
            </div>
        </div>
    )
}
