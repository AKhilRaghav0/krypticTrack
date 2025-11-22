import { useMemo } from 'react'
import useSWR from 'swr'
import { getHeatmap } from '@/services/api'
import { Fire } from '@phosphor-icons/react'

export function ProductivityHeatmap() {
    const { data: heatmap } = useSWR<number[][]>('/stats/heatmap', () => getHeatmap(7))

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const hours = Array.from({ length: 24 }, (_, i) => i)

    // Flatten data for easier rendering if needed, or keep as 2D array
    // heatmap is [day][hour]

    const getColor = (score: number) => {
        if (score === 0) return 'bg-forest-dark/30'
        if (score < 25) return 'bg-forest/40'
        if (score < 50) return 'bg-forest/60'
        if (score < 75) return 'bg-forest/80'
        return 'bg-forest'
    }

    if (!heatmap) return null

    return (
        <div className="gradient-forest grain rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
                <Fire size={24} weight="fill" className="text-earth-tan" />
                <h3 className="text-xl font-bold font-mono text-earth-cream">
                    Productivity Heatmap
                </h3>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    <div className="flex">
                        {/* Y-axis labels (Hours) - Simplified */}
                        <div className="flex flex-col justify-between pr-4 py-2 text-xs font-mono text-earth-cream/50 h-[160px]">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                        </div>

                        {/* Heatmap Grid */}
                        <div className="flex-1 grid grid-cols-7 gap-1">
                            {heatmap.map((dayScores, dayIndex) => (
                                <div key={dayIndex} className="flex flex-col gap-1">
                                    {/* Day Label */}
                                    <div className="text-center text-xs font-mono text-earth-cream/50 mb-2">
                                        {days[dayIndex]}
                                    </div>

                                    {/* Hour Cells */}
                                    {dayScores.map((score, hourIndex) => (
                                        <div
                                            key={hourIndex}
                                            className={`w-full h-1.5 rounded-sm ${getColor(score)} transition-all hover:scale-110 hover:brightness-110 cursor-help relative group`}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-forest-dark text-earth-cream text-xs font-mono rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-earth-cream/10">
                                                {hourIndex}:00 - {score.toFixed(0)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 text-xs font-mono text-earth-cream/50">
                <span>Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm bg-forest-dark/30"></div>
                    <div className="w-3 h-3 rounded-sm bg-forest/40"></div>
                    <div className="w-3 h-3 rounded-sm bg-forest/60"></div>
                    <div className="w-3 h-3 rounded-sm bg-forest/80"></div>
                    <div className="w-3 h-3 rounded-sm bg-forest"></div>
                </div>
                <span>More</span>
            </div>
        </div>
    )
}
