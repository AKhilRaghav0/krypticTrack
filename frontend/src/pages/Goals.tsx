import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Target, Clock, CheckCircle, Warning, Plus, X } from '@phosphor-icons/react'
import { getActiveGoals } from '@/services/api'
import { getDaysUntil } from '@/utils/helpers'
import type { Goal } from '@/types'

export function Goals() {
    const { mutate } = useSWRConfig()
    const { data: goals } = useSWR<Goal[]>('/goals', getActiveGoals, {
        refreshInterval: 30000,
    })

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newGoalText, setNewGoalText] = useState('')
    const [newGoalKeywords, setNewGoalKeywords] = useState('')
    const [newGoalDate, setNewGoalDate] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newGoalText.trim()) return

        setIsSubmitting(true)
        try {
            const response = await fetch('http://localhost:5000/api/goals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    goal_text: newGoalText,
                    keywords: newGoalKeywords.split(',').map(k => k.trim()).filter(k => k),
                    target_date: newGoalDate || null,
                    category: 'general'
                }),
            })

            if (response.ok) {
                setNewGoalText('')
                setNewGoalKeywords('')
                setNewGoalDate('')
                setIsModalOpen(false)
                mutate('/goals') // Refresh goals list
            } else {
                console.error('Failed to create goal')
            }
        } catch (error) {
            console.error('Error creating goal:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-forest-dark p-8">
            <div className="fixed inset-0 bg-[linear-gradient(to_right,#3F4F4410_1px,transparent_1px),linear-gradient(to_bottom,#3F4F4410_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-20" />

            <div className="relative z-10 max-w-7xl mx-auto">
                <div className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold font-mono text-earth-cream mb-2">
                            Goals
                        </h1>
                        <p className="text-earth-cream/60 font-mono">
                            Track progress toward your objectives
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-earth-tan text-forest-dark font-mono font-bold rounded-lg hover:bg-earth-light transition-colors"
                    >
                        <Plus weight="bold" size={20} />
                        New Goal
                    </button>
                </div>

                {/* Goals List */}
                <div className="space-y-6">
                    {goals?.map((goal) => {
                        const daysLeft = goal.targetDate ? getDaysUntil(goal.targetDate) : null
                        const isOverdue = daysLeft !== null && daysLeft < 0
                        const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3

                        return (
                            <div key={goal.id} className="gradient-earth grain rounded-xl p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold font-mono text-earth-cream mb-2">
                                            {goal.goalText}
                                        </h3>

                                        {/* Keywords */}
                                        {goal.keywords.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {goal.keywords.map((keyword) => (
                                                    <span
                                                        key={keyword}
                                                        className="px-2 py-1 bg-earth-tan/20 text-earth-tan rounded text-xs font-mono font-semibold"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Deadline */}
                                    <div className="text-right">
                                        {isOverdue ? (
                                            <div className="flex items-center gap-1 text-status-error font-mono text-sm">
                                                <Warning weight="bold" />
                                                Overdue
                                            </div>
                                        ) : isUrgent ? (
                                            <div className="flex items-center gap-1 text-status-warning font-mono text-sm">
                                                <Clock weight="bold" />
                                                {daysLeft}d left
                                            </div>
                                        ) : daysLeft !== null ? (
                                            <div className="text-earth-cream/70 font-mono text-sm">
                                                {daysLeft}d left
                                            </div>
                                        ) : (
                                            <div className="text-earth-cream/50 font-mono text-sm">
                                                No deadline
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-earth-cream/70 font-mono">Progress</span>
                                        <span className="text-sm font-mono font-semibold text-earth-cream">
                                            {goal.progress.toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="h-3 bg-forest-dark/50 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-earth-tan via-earth-light to-earth-cream grain rounded-full transition-all duration-500"
                                            style={{ width: `${goal.progress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Alignment */}
                                <div className="flex items-center justify-between pt-3 border-t border-earth-cream/10">
                                    <div className="flex items-center gap-2 text-sm text-earth-cream/70 font-mono">
                                        <CheckCircle size={16} weight="bold" />
                                        Weekly Alignment
                                    </div>
                                    <span className={`font-mono font-semibold text-sm ${goal.alignmentPercentage >= 60 ? 'text-status-success' :
                                        goal.alignmentPercentage >= 40 ? 'text-status-warning' :
                                            'text-status-error'
                                        }`}>
                                        {goal.alignmentPercentage.toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {goals?.length === 0 && (
                    <div className="gradient-forest grain rounded-xl p-12 text-center">
                        <Target size={48} className="mx-auto mb-4 text-earth-cream/30" weight="bold" />
                        <p className="text-earth-cream/50 font-mono mb-4">
                            No active goals yet
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-earth-tan text-forest-dark font-mono font-bold rounded-lg hover:bg-earth-light transition-colors"
                        >
                            Create Your First Goal
                        </button>
                    </div>
                )}
            </div>

            {/* Create Goal Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-forest-dark border border-earth-cream/10 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold font-mono text-earth-cream">New Goal</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-earth-cream/50 hover:text-earth-cream transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateGoal} className="space-y-4">
                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Goal Description
                                </label>
                                <input
                                    type="text"
                                    value={newGoalText}
                                    onChange={(e) => setNewGoalText(e.target.value)}
                                    placeholder="e.g., Master Python Backend Development"
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Keywords (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={newGoalKeywords}
                                    onChange={(e) => setNewGoalKeywords(e.target.value)}
                                    placeholder="python, flask, api, backend"
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                />
                                <p className="text-xs text-earth-cream/40 mt-1 font-mono">
                                    Used to track relevant activities automatically
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Target Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={newGoalDate}
                                    onChange={(e) => setNewGoalDate(e.target.value)}
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-earth-cream/10 text-earth-cream font-mono rounded-lg hover:bg-earth-cream/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2 bg-earth-tan text-forest-dark font-mono font-bold rounded-lg hover:bg-earth-light transition-colors disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Goal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
