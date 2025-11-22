import { useMemo } from 'react'

interface ActivityData {
    hour: string
    productivity: number
}

interface ActivityChartProps {
    data?: ActivityData[]
}

export function ActivityChart({ data }: ActivityChartProps) {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) {
            // Generate empty 24h data if none provided
            return Array.from({ length: 24 }, (_, i) => ({
                hour: i.toString().padStart(2, '0'),
                productivity: 0
            }))
        }
        return data
    }, [data])



    return (
        <div className="gradient-forest grain rounded-xl p-6 h-full flex flex-col">
            <h3 className="text-earth-cream font-mono font-bold text-xl mb-6">
                24-Hour Activity
            </h3>

            <div className="flex-1 flex items-end gap-1 min-h-[200px]">
                {chartData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-forest-dark border border-earth-cream/10 p-2 rounded text-xs font-mono text-earth-cream z-10 pointer-events-none whitespace-nowrap">
                            {d.hour}:00 - {d.productivity}%
                        </div>

                        {/* Bar */}
                        <div
                            className="w-full bg-earth-tan/20 rounded-t-sm relative overflow-hidden transition-all duration-500 group-hover:bg-earth-tan/30"
                            style={{ height: `${d.productivity}%` }}
                        >
                            <div
                                className="absolute bottom-0 left-0 right-0 bg-earth-tan transition-all duration-500"
                                style={{ height: '100%', opacity: d.productivity / 100 }}
                            />
                        </div>

                        {/* Label (every 4 hours) */}
                        {i % 4 === 0 && (
                            <span className="text-[10px] font-mono text-earth-cream/50 absolute -bottom-5">
                                {d.hour}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
