import { useState } from 'react'
import { useActions } from '../hooks/useActions'
import { getSourceIcon, getSourceColors, formatActionType } from '../utils/sourceUtils'

export default function Activity() {
  const { actions, total, loading } = useActions(100)
  const [sourceFilter, setSourceFilter] = useState('')
  const [actionTypeFilter, setActionTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('timestamp')


  const filteredActions = actions
    .filter((action) => {
      if (sourceFilter && action.source !== sourceFilter) return false
      if (actionTypeFilter && action.action_type !== actionTypeFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'timestamp') {
        return b.timestamp - a.timestamp
      }
      return 0
    })

  const uniqueSources = [...new Set(actions.map((a) => a.source))]
  const uniqueActionTypes = [...new Set(actions.map((a) => a.action_type))]

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">
          Activity
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
          View and filter your activity history
        </p>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
              >
                <option value="">All Sources</option>
                {uniqueSources.map((source) => (
                  <option key={source} value={source}>
                    {source.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action Type
              </label>
              <select
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                {uniqueActionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
              >
                <option value="timestamp">Most Recent</option>
                <option value="source">Source</option>
                <option value="action_type">Action Type</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{total.toLocaleString()}</span> total
                actions
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="px-6 py-16 text-center text-gray-500">
                Loading actions...
              </div>
            ) : filteredActions.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-500">
                No actions found
              </div>
            ) : (
              filteredActions.slice(0, 20).map((action: any, idx: number) => {
                const Icon = getSourceIcon(action.source)
                const colors = getSourceColors(action.source)
                const actionName = formatActionType(action.action_type)

                return (
                  <div
                    key={idx}
                    className="px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 ${colors.bg} rounded-full flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {actionName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(action.timestamp * 1000).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {action.source.toUpperCase()} •{' '}
                          {new Date(action.timestamp * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Actions Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Actions Table</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Loading actions...
                    </td>
                  </tr>
                ) : filteredActions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No actions yet
                    </td>
                  </tr>
                ) : (
                  filteredActions.slice(0, 50).map((action: any, idx: number) => {
                    const Icon = getSourceIcon(action.source)
                    const colors = getSourceColors(action.source)
                    const actionName = formatActionType(action.action_type)

                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center`}
                            >
                              <Icon className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {actionName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(action.timestamp * 1000).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${colors.text} font-medium`}>
                            {action.source.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">{actionName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {JSON.stringify(action.context || {})}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
