import { useState } from 'react'
import { Database, Shield, Bell, Trash } from '@phosphor-icons/react'

export default function Settings() {
  const [settings, setSettings] = useState({
    dataCollection: true,
    notifications: true,
    encryption: true,
  })

  return (
    <div className="animate-fade-in">
      <div className="mb-8 pb-6 border-b border-gray-700">
        <h1 className="text-4xl font-bold text-gray-100 tracking-tight mb-2">
          Settings
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
          Manage your preferences and data settings
        </p>
      </div>

      <div className="space-y-6">
        {/* Data Collection */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#d4a574]/20 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-[#d4a574]" />
              </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Data Collection</h2>
              <p className="text-sm text-gray-400">Control what data is collected</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-gray-600 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors">
              <div>
                <div className="font-semibold text-gray-100">Enable Data Collection</div>
                <div className="text-sm text-gray-400">
                  Track your activity across applications
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.dataCollection}
                onChange={(e) =>
                  setSettings({ ...settings, dataCollection: e.target.checked })
                }
                className="w-5 h-5 text-secondary-500 rounded focus:ring-secondary-500"
              />
            </label>
          </div>
        </div>

        {/* Privacy & Security */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#a31d1d]/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#a31d1d]" />
              </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Privacy & Security</h2>
              <p className="text-sm text-gray-400">Manage your data security</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-gray-600 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors">
              <div>
                <div className="font-semibold text-gray-100">Database Encryption</div>
                <div className="text-sm text-gray-400">
                  Encrypt stored data for enhanced security
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.encryption}
                onChange={(e) =>
                  setSettings({ ...settings, encryption: e.target.checked })
                }
                className="w-5 h-5 text-secondary-500 rounded focus:ring-secondary-500"
              />
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-700/50 rounded-xl flex items-center justify-center">
                <Bell className="w-6 h-6 text-gray-300" />
              </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Notifications</h2>
              <p className="text-sm text-gray-400">Control notification preferences</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-gray-600 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors">
              <div>
                <div className="font-semibold text-gray-100">Enable Notifications</div>
                <div className="text-sm text-gray-400">
                  Receive alerts about important events
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) =>
                  setSettings({ ...settings, notifications: e.target.checked })
                }
                className="w-5 h-5 text-secondary-500 rounded focus:ring-secondary-500"
              />
            </label>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <Trash className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-100">Data Management</h2>
              <p className="text-sm text-gray-400">Manage your stored data</p>
            </div>
          </div>
          <div className="space-y-4">
            <button className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-gray-100 font-semibold hover:bg-gray-700 transition-all">
              Export Data
            </button>
            <button className="w-full px-4 py-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 font-semibold hover:bg-red-900/50 transition-all">
              Delete All Data
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Database Path
              </div>
              <div className="text-sm font-semibold text-gray-900">data/kryptic_track.db</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Encryption
              </div>
              <div className="text-sm font-semibold text-green-600">Enabled</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
