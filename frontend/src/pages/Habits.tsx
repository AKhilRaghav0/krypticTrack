import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { Flame, ArrowUp, Plus, X } from '@phosphor-icons/react'
import { getHabits } from '@/services/api'
import type { Habit } from '@/types'

export function Habits() {
    const { mutate } = useSWRConfig()
    const { data: habits } = useSWR<Habit[]>('/habits', getHabits, {
        refreshInterval: 60000,
    })

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newHabitName, setNewHabitName] = useState('')
    const [newHabitDesc, setNewHabitDesc] = useState('')
    const [newHabitKeywords, setNewHabitKeywords] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleCreateHabit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newHabitName.trim() || !newHabitDesc.trim()) return

        setIsSubmitting(true)
        try {
            const response = await fetch('http://localhost:5000/api/habits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newHabitName.toLowerCase().replace(/\s+/g, '_'),
                    description: newHabitDesc,
                    keywords: newHabitKeywords.split(',').map(k => k.trim()).filter(k => k),
                    target_value: 1,
                    unit: 'count'
                }),
            })

            if (response.ok) {
                setNewHabitName('')
                setNewHabitDesc('')
                setNewHabitKeywords('')
                setIsModalOpen(false)
                mutate('/habits')
            } else {
                console.error('Failed to create habit')
            }
        } catch (error) {
            console.error('Error creating habit:', error)
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
                            Habit Tracker
                        </h1>
                        <p className="text-earth-cream/60 font-mono">
                            Build consistency, track streaks
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-earth-tan text-forest-dark font-mono font-bold rounded-lg hover:bg-earth-light transition-colors"
                    >
                        <Plus weight="bold" size={20} />
                        New Habit
                    </button>
                </div>

                {/* Habits Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {habits?.map((habit) => (
                        <div key={habit.name} className="gradient-earth grain rounded-xl p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold font-mono text-earth-cream mb-1">
                                        {habit.description}
                                    </h3>
                                    <p className="text-sm text-earth-cream/60 font-mono">
                                        {habit.name}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <div className="text-3xl font-bold font-mono text-earth-tan flex items-center gap-1">
                                        {habit.currentStreak}
                                        {habit.currentStreak >= 7 && <Flame weight="fill" className="text-earth-tan" />}
                                    </div>
                                    <p className="text-xs text-earth-cream/50 font-mono">
                                        day streak
                                    </p>
                                </div>
                            </div>

                            {/* Consistency Bars */}
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-earth-cream/70 font-mono">7-day</span>
                                        <span className="text-sm font-mono font-semibold text-earth-cream">
                                            {(habit.consistency7d || 0).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-forest-dark/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-earth-tan to-earth-cream rounded-full"
                                            style={{ width: (habit.consistency7d || 0) + '%' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm text-earth-cream/70 font-mono">30-day</span>
                                        <span className="text-sm font-mono font-semibold text-earth-cream">
                                            {(habit.consistency30d || 0).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-forest-dark/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-status-success to-earth-tan rounded-full"
                                            style={{ width: (habit.consistency30d || 0) + '%' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Best Streak */}
                            <div className="mt-4 pt-4 border-t border-earth-cream/10">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-earth-cream/60 font-mono">Best Streak</span>
                                    <span className="font-mono font-semibold text-earth-cream flex items-center gap-1">
                                        <ArrowUp size={16} />
                                        {habit.longestStreak} days
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Calendar Placeholder */}
                <div className="gradient-forest grain rounded-xl p-8">
                    <h3 className="text-xl font-bold font-mono text-earth-cream mb-4">
                        Contribution Calendar
                    </h3>
                    <div className="h-32 flex items-center justify-center text-earth-cream/50 font-mono">
                        GitHub-style calendar visualization coming soon...
                    </div>
                </div>
            </div>

            {/* Create Habit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-forest-dark border border-earth-cream/10 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold font-mono text-earth-cream">New Habit</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-earth-cream/50 hover:text-earth-cream transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateHabit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Habit Name (ID)
                                </label>
                                <input
                                    type="text"
                                    value={newHabitName}
                                    onChange={(e) => setNewHabitName(e.target.value)}
                                    placeholder="e.g., drink_water"
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={newHabitDesc}
                                    onChange={(e) => setNewHabitDesc(e.target.value)}
                                    placeholder="e.g., Drink 2L of water daily"
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
                                    value={newHabitKeywords}
                                    onChange={(e) => setNewHabitKeywords(e.target.value)}
                                    placeholder="water, hydrate, bottle"
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
                                    {isSubmitting ? 'Creating...' : 'Create Habit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
