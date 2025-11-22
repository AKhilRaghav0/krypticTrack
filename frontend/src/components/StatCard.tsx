import { cn, getProductivityColor, getProductivityBgColor } from '@/utils/helpers'
import { motion } from 'framer-motion'

interface StatCardProps {
    label: string
    value: string | number
    icon: React.ReactNode
    trend?: number
    className?: string
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
    return (
        <motion.div
            className={cn('card-hover gradient-forest grain overflow-hidden', className)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
        >
            <div className="relative z-20">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-earth-cream/70 text-sm font-mono">{label}</span>
                    <span className="text-2xl text-earth-tan">{icon}</span>
                </div>

                <div className="text-3xl font-bold font-mono text-earth-cream">
                    {value}
                </div>

                {trend !== undefined && (
                    <div className={cn(
                        'flex items-center gap-1 mt-2 text-sm font-mono',
                        trend > 0 ? 'text-status-success' : 'text-status-error'
                    )}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </motion.div>
    )
}

interface ProductivityBadgeProps {
    score: number
    className?: string
}

export function ProductivityBadge({ score, className }: ProductivityBadgeProps) {
    return (
        <span className={cn(
            'px-3 py-1 rounded-full text-sm font-mono font-semibold',
            getProductivityBgColor(score),
            getProductivityColor(score),
            className
        )}>
            {score}/{100}
        </span>
    )
}
