import useSWR from 'swr'
import { Lightbulb, ArrowUp, Warning, Sparkle } from '@phosphor-icons/react'
import { getPredictions, getPatterns, getBlockers } from '@/services/api'
import type { Prediction, Pattern, Blocker } from '@/types'

export function Insights() {
    const { data: prediction } = useSWR<Prediction>('/predictions', getPredictions, {
        refreshInterval: 60000,
    })

    const { data: patterns } = useSWR<Pattern[]>('/patterns', getPatterns)
    const { data: blockers } = useSWR<Blocker[]>('/blockers', getBlockers)

    return (
        <div className="min-h-screen bg-forest-dark p-8">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#3F4F4410_1px,transparent_1px),linear-gradient(to_bottom,#3F4F4410_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-20" />

            <div className="relative z-10 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold font-mono text-earth-cream mb-2">
                        AI Insights
                    </h1>
                    <p className="text-earth-cream/60 font-mono">
                        Patterns, predictions, and recommendations
                    </p>
                </div>

                {/* AI Prediction Hero */}
                {prediction && (
                    <div className="gradient-warm grain rounded-2xl p-12 mb-8 text-center">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <Sparkle size={24} weight="fill" className="text-forest-dark" />
                            <h2 className="text-sm font-mono font-semibold text-forest-dark/70">
                                Today's Prediction
                            </h2>
                        </div>

                        <div className="text-7xl font-bold font-mono text-forest-dark mb-3">
                            {prediction.predictedScore.toFixed(0)}
                            <span className="text-3xl text-forest-dark/40">/100</span>
                        </div>

                        <div className="inline-block px-4 py-2 bg-forest-dark/10 rounded-full">
                            <p className="text-sm font-mono text-forest-dark/70">
                                {(prediction.confidence * 100).toFixed(0)}% confidence • {prediction.reasoning}
                            </p>
                        </div>
                    </div>
                )}

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Productive Environments */}
                    <div className="gradient-forest grain rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ArrowUp size={24} weight="bold" className="text-earth-tan" />
                            <h3 className="text-xl font-bold font-mono text-earth-cream">
                                Productive Environments
                            </h3>
                        </div>

                        {patterns && patterns.length > 0 ? (
                            <div className="space-y-3">
                                {patterns.map((pattern, i) => (
                                    <div
                                        key={i}
                                        className="bg-forest/50 rounded-lg p-4 border border-earth-cream/10"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <p className="text-earth-cream font-mono text-sm">
                                                    {pattern.apps.slice(0, 3).join(' + ')}
                                                </p>
                                            </div>
                                            <span className="text-earth-tan font-mono font-semibold text-sm">
                                                {pattern.avgProductivity.toFixed(0)}/100
                                            </span>
                                        </div>
                                        <p className="text-earth-cream/50 font-mono text-xs">
                                            Used {pattern.frequency}x
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-earth-cream/50 font-mono text-sm">
                                Not enough data to detect patterns
                            </p>
                        )}
                    </div>

                    {/* Blockers */}
                    <div className="gradient-earth grain rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Warning size={24} weight="bold" className="text-status-warning" />
                            <h3 className="text-xl font-bold font-mono text-earth-cream">
                                Productivity Blockers
                            </h3>
                        </div>

                        {blockers && blockers.length > 0 ? (
                            <div className="space-y-4">
                                {blockers.map((blocker, i) => (
                                    <div key={i} className="bg-forest-dark/30 rounded-lg p-4">
                                        <div className="flex items-start gap-2 mb-2">
                                            <Warning size={16} weight="bold" className="text-status-warning mt-1" />
                                            <div className="flex-1">
                                                <p className="text-earth-cream font-mono font-semibold text-sm mb-1">
                                                    {blocker.pattern}
                                                </p>
                                                <p className="text-earth-cream/60 font-mono text-xs mb-2">
                                                    {blocker.impact}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pl-6">
                                            <p className="text-status-info font-mono text-xs">
                                                💡 {blocker.suggestion}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-status-success font-mono text-sm">
                                    ✨ No blockers detected!
                                </p>
                                <p className="text-earth-cream/50 font-mono text-xs mt-1">
                                    You're on a roll
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weekly Review Placeholder */}
                <div className="gradient-forest grain rounded-xl p-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Lightbulb size={24} weight="fill" className="text-earth-tan" />
                        <h3 className="text-xl font-bold font-mono text-earth-cream">
                            AI Weekly Review
                        </h3>
                    </div>
                    <div className="text-center py-12 text-earth-cream/50 font-mono">
                        Generate comprehensive weekly review with AI analysis
                        <br />
                        <button className="btn-primary mt-4">
                            Generate Review
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
