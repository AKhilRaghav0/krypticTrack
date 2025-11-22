import { Clock, Code } from '@phosphor-icons/react'
import { formatDuration, formatDate } from '@/utils/helpers'
import type { Session } from '@/types'

interface RecentSessionsProps {
    sessions?: Session[]
}

export function RecentSessions({ sessions }: RecentSessionsProps) {
    return (
        <div className="gradient-forest grain rounded-xl p-6 h-full">
            <h3 className="text-earth-cream font-mono font-bold text-xl mb-4">
                Recent Sessions
            </h3>

            <div className="space-y-4">
                {sessions?.slice(0, 4).map((session) => (
                    <div
                        key={session.id}
                        className="bg-forest-dark/30 rounded-lg p-3 border border-earth-cream/5 hover:border-earth-cream/10 transition-colors"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-earth-cream font-mono font-semibold text-sm">
                                {session.project}
                            </span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${session.productivity >= 80 ? 'bg-status-success/20 text-status-success' :
                                session.productivity >= 50 ? 'bg-status-warning/20 text-status-warning' :
                                    'bg-status-error/20 text-status-error'
                                }`}>
                                {session.productivity}%
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-earth-cream/50 font-mono">
                            <span className="flex items-center gap-1">
                                <Code size={12} />
                                {session.sessionType}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(session.startTime)} • {formatDuration(session.duration)}
                            </span>
                        </div>
                    </div>
                ))}

                {(!sessions || sessions.length === 0) && (
                    <div className="text-center text-earth-cream/30 font-mono py-8 text-sm">
                        No recent sessions
                    </div>
                )}
            </div>
        </div>
    )
}
