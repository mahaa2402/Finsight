// frontend/src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

const Settings: React.FC = () => {
  const { user, updateUser, logout } = useAuth();

  // Profile state
  const [name, setName]                   = useState(user?.name || '');
  const [email, setEmail]                 = useState(user?.email || '');
  const [password, setPassword]           = useState('');
  const [currency, setCurrency]           = useState('INR');
  const [monthlyIncome, setMonthlyIncome] = useState('125000');

  // Settings state
  const [theme, setTheme]                 = useState<'dark-mesh' | 'midnight' | 'cyberpunk'>('dark-mesh');
  const [emailAlerts, setEmailAlerts]     = useState(true);
  const [anomalyPush, setAnomalyPush]     = useState(true);
  const [budgetWarnings, setBudgetWarnings] = useState(true);
  const [weeklyDigest, setWeeklyDigest]   = useState(false);

  // Status feedback
  const [saving, setSaving]               = useState(false);
  const [savedSuccess, setSavedSuccess]   = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSavedSuccess(false);

    try {
      const payload: { name?: string; email?: string; password?: string } = {
        name: name.trim(),
        email: email.trim(),
      };
      if (password.trim()) {
        if (password.trim().length < 6) {
          throw new Error('New password must be at least 6 characters');
        }
        payload.password = password.trim();
      }

      const updated = await authApi.updateMe(payload);
      updateUser(updated);
      setPassword('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">⚙️ Profile & System Settings</h1>
            <p className="page-subtitle">Configure personal identification, baseline income parameters, security, and notification triggers</p>
          </div>
        </div>

        {/* Success Alert */}
        {savedSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-slide-down">
            <span className="text-xl">✅</span>
            Settings and profile parameters updated successfully in MySQL!
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center gap-3 animate-slide-down">
            <span className="text-xl">⚠️</span>
            {errorMsg}
          </div>
        )}

        <div className="space-y-8">
          {/* Profile Section */}
          <div className="section-card">
            <h2 className="section-title">
              <span>👤</span> User Profile (Authenticated Account)
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="flex items-center gap-5 pb-6 border-b border-surface-700/50">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-400 flex items-center justify-center text-white text-2xl font-bold shadow-glow">
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{name || 'Account Holder'}</h3>
                  <p className="text-surface-400 text-xs">{email}</p>
                  <span className="badge-success text-[10px] mt-1 font-mono">User ID: #{user?.id} • Active</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Update Password (Optional)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep unchanged"
                    className="form-input"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label className="form-label">Default Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="form-select"
                  >
                    <option value="INR">₹ INR (Indian Rupee)</option>
                    <option value="USD">$ USD (US Dollar)</option>
                    <option value="EUR">€ EUR (Euro)</option>
                    <option value="GBP">£ GBP (British Pound)</option>
                    <option value="AED">د.إ AED (UAE Dirham)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="form-label">Monthly Expected Income</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 font-semibold">₹</span>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  🚪 Log Out from this device
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                  {saving ? '⏳ Saving...' : '💾 Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Theme & Display Settings */}
          <div className="section-card">
            <h2 className="section-title">
              <span>🎨</span> Theme & Interface Aesthetics
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                onClick={() => setTheme('dark-mesh')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  theme === 'dark-mesh'
                    ? 'border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/30'
                    : 'border-surface-700/60 bg-surface-800/40 hover:border-surface-600'
                }`}
              >
                <div className="h-10 rounded-lg bg-surface-950 border border-primary-500/30 flex items-center px-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mr-2" />
                  <div className="w-12 h-2 rounded bg-surface-700" />
                </div>
                <p className="font-bold text-white text-sm">Dark Luxury (Default)</p>
                <p className="text-xs text-surface-400 mt-1">Deep obsidian with dynamic indigo ambient mesh</p>
              </div>

              <div
                onClick={() => setTheme('midnight')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  theme === 'midnight'
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30'
                    : 'border-surface-700/60 bg-surface-800/40 hover:border-surface-600'
                }`}
              >
                <div className="h-10 rounded-lg bg-purple-950 border border-purple-500/30 flex items-center px-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-400 mr-2" />
                  <div className="w-12 h-2 rounded bg-surface-700" />
                </div>
                <p className="font-bold text-white text-sm">Midnight Violet</p>
                <p className="text-xs text-surface-400 mt-1">Sleek royal purple undertones with high contrast</p>
              </div>

              <div
                onClick={() => setTheme('cyberpunk')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  theme === 'cyberpunk'
                    ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'border-surface-700/60 bg-surface-800/40 hover:border-surface-600'
                }`}
              >
                <div className="h-10 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center px-3 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2" />
                  <div className="w-12 h-2 rounded bg-surface-700" />
                </div>
                <p className="font-bold text-white text-sm">Cyber Emerald</p>
                <p className="text-xs text-surface-400 mt-1">Fintech green telemetry with laser-sharp styling</p>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="section-card">
            <h2 className="section-title">
              <span>🔔</span> Notification Controls
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40 border border-surface-700/30">
                <div>
                  <p className="font-semibold text-white text-sm">Over-Budget Exceeded Triggers</p>
                  <p className="text-xs text-surface-400">Receive instant push notification when category spend crosses 100% threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={budgetWarnings}
                  onChange={(e) => setBudgetWarnings(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-600 bg-surface-700 text-primary-500 accent-primary-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40 border border-surface-700/30">
                <div>
                  <p className="font-semibold text-white text-sm">🚨 ML Anomaly Alerts</p>
                  <p className="text-xs text-surface-400">Flag transactions with statistical deviation &gt; 2.5σ immediately</p>
                </div>
                <input
                  type="checkbox"
                  checked={anomalyPush}
                  onChange={(e) => setAnomalyPush(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-600 bg-surface-700 text-primary-500 accent-primary-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40 border border-surface-700/30">
                <div>
                  <p className="font-semibold text-white text-sm">Weekly Executive Digest</p>
                  <p className="text-xs text-surface-400">Receive email roundup of monthly progress and ML forecasting updates</p>
                </div>
                <input
                  type="checkbox"
                  checked={weeklyDigest}
                  onChange={(e) => setWeeklyDigest(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-600 bg-surface-700 text-primary-500 accent-primary-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40 border border-surface-700/30">
                <div>
                  <p className="font-semibold text-white text-sm">Email Transaction Receipts</p>
                  <p className="text-xs text-surface-400">Send confirmation upon CSV batch imports or manual ledger entries</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-600 bg-surface-700 text-primary-500 accent-primary-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
