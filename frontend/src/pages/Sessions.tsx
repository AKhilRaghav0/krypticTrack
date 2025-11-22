import { useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { MagnifyingGlass, Clock, Code, X } from '@phosphor-icons/react'
import { ProductivityBadge } from '@/components/StatCard'
import { getSessions } from '@/services/api'
import { formatDate, formatDuration } from '@/utils/helpers'
import type { Session } from '@/types'

export function Sessions() {
    const [search, setSearch] = useState('')
    const [filterProject, setFilterProject] = useState('')

    const { data: sessions } = useSWR<Session[]>('/sessions', getSessions, {
        refreshInterval: 30000,
    })

    const filteredSessions = sessions?.filter(s => {
        const matchesSearch = !search ||
            s.project.toLowerCase().includes(search.toLowerCase()) ||
            s.sessionType.toLowerCase().includes(search.toLowerCase())
        const matchesProject = !filterProject || s.project === filterProject
        return matchesSearch && matchesProject
    })

    const projects = Array.from(new Set(sessions?.map(s => s.project) || []))

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newSessionProject, setNewSessionProject] = useState('')
    const [newSessionType, setNewSessionType] = useState('coding')
    const [newSessionDuration, setNewSessionDuration] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { mutate } = useSWRConfig()

    const handleLogSession = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newSessionProject.trim() || !newSessionDuration) return

        setIsSubmitting(true)
        try {
            const response = await fetch('http://localhost:5000/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    project: newSessionProject,
                    session_type: newSessionType,
                    duration: parseInt(newSessionDuration)
                }),
            })

            if (response.ok) {
                setNewSessionProject('')
                setNewSessionType('coding')
                setNewSessionDuration('')
                setIsModalOpen(false)
                mutate('/sessions')
            } else {
                console.error('Failed to log session')
            }
        } catch (error) {
            console.error('Error logging session:', error)
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
                            Work Sessions
                        </h1>
                        <p className="text-earth-cream/60 font-mono">
                            Browse and analyze your coding sessions
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-earth-tan text-forest-dark font-mono font-bold rounded-lg hover:bg-earth-light transition-colors"
                    >
                        <Clock weight="bold" size={20} />
                        Log Session
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="flex gap-4 mb-6">
                    <div className="flex-1 relative">
                        <MagnifyingGlass
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-earth-cream/40"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                        />
                    </div>

                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors cursor-pointer"
                    >
                        <option value="">All Projects</option>
                        {projects.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>

                {/* Sessions Table */}
                <div className="gradient-forest grain rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-earth-cream/10">
                                    <th className="text-left p-4 text-earth-cream/70 font-mono text-sm font-semibold">
                                        Date & Time
                                    </th>
                                    <th className="text-left p-4 text-earth-cream/70 font-mono text-sm font-semibold">
                                        Project
                                    </th>
                                    <th className="text-left p-4 text-earth-cream/70 font-mono text-sm font-semibold">
                                        Type
                                    </th>
                                    <th className="text-right p-4 text-earth-cream/70 font-mono text-sm font-semibold">
                                        Duration
                                    </th>
                                    <th className="text-right p-4 text-earth-cream/70 font-mono text-sm font-semibold">
                                        Productivity
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSessions?.map((session) => (
                                    <tr
                                        key={session.id}
                                        className="border-b border-earth-cream/5 hover:bg-forest/50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 text-earth-cream/90 font-mono text-sm">
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-earth-tan" />
                                                {formatDate(session.startTime)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-earth-cream font-mono font-semibold">
                                            {session.project}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-earth-cream/80 font-mono text-sm">
                                                <Code size={16} className="text-earth-tan" />
                                                {session.sessionType}
                                            </div>
                                        </td>
                                        <td className="p-4 text-earth-cream/90 font-mono text-sm text-right">
                                            {formatDuration(session.duration)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <ProductivityBadge score={session.productivity} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredSessions?.length === 0 && (
                        <div className="p-12 text-center text-earth-cream/50 font-mono">
                            No sessions found
                        </div>
                    )}
                </div>
            </div>

            {/* Log Session Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-forest-dark border border-earth-cream/10 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold font-mono text-earth-cream">Log Session</h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-earth-cream/50 hover:text-earth-cream transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleLogSession} className="space-y-4">
                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Project Name
                                </label>
                                <input
                                    type="text"
                                    value={newSessionProject}
                                    onChange={(e) => setNewSessionProject(e.target.value)}
                                    placeholder="e.g., krypticTrack"
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Session Type
                                </label>
                                <select
                                    value={newSessionType}
                                    onChange={(e) => setNewSessionType(e.target.value)}
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                >
                                    <option value="coding">Coding</option>
                                    <option value="learning">Learning</option>
                                    <option value="debugging">Debugging</option>
                                    <option value="planning">Planning</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-mono text-earth-cream/70 mb-1">
                                    Duration (minutes)
                                </label>
                                <input
                                    type="number"
                                    value={newSessionDuration}
                                    onChange={(e) => setNewSessionDuration(e.target.value)}
                                    placeholder="e.g., 45"
                                    min="1"
                                    className="w-full bg-forest-light border border-earth-cream/10 rounded-lg px-4 py-2 text-earth-cream font-mono focus:outline-none focus:border-earth-tan transition-colors"
                                    required
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
                                    {isSubmitting ? 'Logging...' : 'Log Session'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
