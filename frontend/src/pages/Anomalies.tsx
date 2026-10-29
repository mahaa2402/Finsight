import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsApi, type AnomalyItem, type AnomalyMetrics } from '../services/api';

const fmt = (n: number) => n.toLocaleString('en-IN');

const Anomalies: React.FC = () => {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [metrics, setMetrics] = useState<AnomalyMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [sensitivity, setSensitivity] = useState<number>(2.5);
  const [selectedAlgo, setSelectedAlgo] = useState<'zscore' | 'iqr' | 'isolation_forest'>('zscore');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'flagged' | 'verified'>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch dynamic real-time anomalies ──
  const loadAnomalies = useCallback(async (algo: string, threshold: number, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const res = await analyticsApi.anomalies({
        algorithm: algo,
        threshold: threshold,
      });
      setAnomalies(res.anomalies || []);
      setMetrics(res.metrics || null);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Failed to load anomalies:', err);
      setError(err.message || 'Failed to analyze real-time transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load and whenever algo changes
  useEffect(() => {
    loadAnomalies(selectedAlgo, sensitivity);
  }, [selectedAlgo, loadAnomalies]);

  // Debounced sensitivity slider change
  const handleSensitivityChange = (newVal: number) => {
    setSensitivity(newVal);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      loadAnomalies(selectedAlgo, newVal);
    }, 280);
  };

  // ── Auto-refresh poller for real-time live data updates ──
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAnomalies(selectedAlgo, sensitivity, true);
    }, 15000); // Poll every 15s for live additions

    return () => clearInterval(interval);
  }, [autoRefresh, selectedAlgo, sensitivity, loadAnomalies]);

  // ── Audit status update (Persistent in MySQL) ──
  const handleAction = async (item: AnomalyItem, newStatus: 'verified' | 'flagged') => {
    // Optimistic UI update
    setAnomalies(prev =>
      prev.map(a => (a.transaction_id === item.transaction_id ? { ...a, status: newStatus } : a))
    );

    try {
      await analyticsApi.updateAnomalyStatus(item.transaction_id, newStatus);
      // Refresh metrics silently
      loadAnomalies(selectedAlgo, sensitivity, true);
    } catch (err: any) {
      console.error('Failed to save audit review:', err);
      // Revert if error
      loadAnomalies(selectedAlgo, sensitivity, true);
    }
  };

  // ── Simulate live anomaly spike ──
  const handleSimulateSpike = async () => {
    setSimulating(true);
    try {
      // Pick random category with unusual amount
      const sampleCategories = [
        { cat: 'Shopping', amt: 14850, desc: 'Flagship Electronics Flash Purchase' },
        { cat: 'Food & Dining', amt: 6400, desc: 'Ultra-Fine Dining Private Suite' },
        { cat: 'Travel', amt: 12200, desc: 'Luxury Heli-Transit Charter' },
        { cat: 'Entertainment', amt: 9500, desc: 'VIP Arena Festival Pass' },
      ];
      const pick = sampleCategories[Math.floor(Math.random() * sampleCategories.length)];
      
      await analyticsApi.simulateAnomaly({
        category: pick.cat,
        amount: pick.amt,
        description: pick.desc,
      });

      // Immediately refresh real-time data
      await loadAnomalies(selectedAlgo, sensitivity, true);
    } catch (err: any) {
      setError(err.message || 'Failed to simulate transaction spike');
    } finally {
      setSimulating(false);
    }
  };

  // ── Derived metrics ──
  const pendingCount = metrics?.pending_count ?? anomalies.filter(a => a.status === 'pending').length;
  const flaggedCount = metrics?.flagged_count ?? anomalies.filter(a => a.status === 'flagged').length;
  const verifiedCount = metrics?.verified_count ?? anomalies.filter(a => a.status === 'verified').length;
  const totalExposure = metrics?.exposure_sum ?? anomalies
    .filter(a => a.status !== 'verified')
    .reduce((sum, a) => sum + a.amount, 0);

  const filteredAnomalies = anomalies.filter(a => {
    if (statusFilter === 'all') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-info text-[10px] font-mono tracking-widest uppercase">
                Dynamic ML Engine
              </span>
              <span className="text-surface-500 text-xs">•</span>
              <span className="text-xs text-surface-400 font-mono">
                Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <h1 className="page-title">🚨 Real-Time Anomaly Detection</h1>
            <p className="page-subtitle">
              Live algorithmic outlier diagnostics computed dynamically across your database transactions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 sm:mt-0">
            {/* Auto refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-surface-800/60 border-surface-700/50 text-surface-400'
              }`}
              title="Toggle 15-second real-time polling"
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-surface-500'}`} />
              {autoRefresh ? 'Live Polling Active' : 'Polling Paused'}
            </button>

            {/* Manual refresh button */}
            <button
              onClick={() => loadAnomalies(selectedAlgo, sensitivity, true)}
              disabled={refreshing || loading}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              title="Fetch latest database transactions"
            >
              <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
              {refreshing ? 'Analyzing...' : 'Refresh'}
            </button>

            {/* Live spike simulation test button */}
            <button
              onClick={handleSimulateSpike}
              disabled={simulating}
              className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-glow"
              title="Inject an authentic high-value expense to test real-time detection"
            >
              <span>{simulating ? '⚡' : '➕'}</span>
              {simulating ? 'Injecting Spike...' : 'Simulate Spike'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadAnomalies(selectedAlgo, sensitivity)}
              className="text-xs underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Diagnostic KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-5 border-rose-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400 font-semibold uppercase">Pending Audit</p>
              <span className="text-xl">⚠️</span>
            </div>
            <p className="text-3xl font-extrabold text-rose-400 mt-2">{pendingCount}</p>
            <p className="text-xs text-surface-500 mt-1">Exceeding statistical boundary</p>
          </div>

          <div className="glass-card p-5 border-amber-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400 font-semibold uppercase">Exposure Sum</p>
              <span className="text-xl">💳</span>
            </div>
            <p className="text-3xl font-extrabold text-amber-300 mt-2">₹{fmt(totalExposure)}</p>
            <p className="text-xs text-surface-500 mt-1">Total unverified outlay under review</p>
          </div>

          <div className="glass-card p-5 border-primary-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400 font-semibold uppercase">Active Sensitivity</p>
              <span className="text-xl">🎛️</span>
            </div>
            <p className="text-3xl font-extrabold text-primary-300 mt-2">{sensitivity.toFixed(1)}σ</p>
            <p className="text-xs text-surface-500 mt-1">
              {selectedAlgo === 'iqr' ? "Tukey's IQR Factor" : selectedAlgo === 'isolation_forest' ? 'Ensemble Contamination' : 'Gaussian Standard Deviation'}
            </p>
          </div>

          <div className="glass-card p-5 border-emerald-500/30">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400 font-semibold uppercase">Analyzed Transactions</p>
              <span className="text-xl">📊</span>
            </div>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">{metrics?.total_analyzed ?? 0}</p>
            <p className="text-xs text-surface-500 mt-1">Live records in database evaluated</p>
          </div>
        </div>

        {/* Algorithm Configuration Panel */}
        <div className="section-card mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h2 className="section-title mb-1">
                <span>🔬</span> Algorithmic Model Selection & Sensitivity
              </h2>
              <p className="text-surface-400 text-sm">
                Real-time computation automatically executes across your personal MySQL transaction records
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-400 font-medium">Model:</span>
                <select
                  value={selectedAlgo}
                  onChange={(e) => setSelectedAlgo(e.target.value as any)}
                  className="form-select text-xs py-1.5 px-3 bg-surface-800 text-white border-surface-700 rounded-lg focus:border-primary-500"
                >
                  <option value="zscore">Gaussian Z-Score (σ Standard Deviation)</option>
                  <option value="iqr">Interquartile Range (IQR Tukey Fences)</option>
                  <option value="isolation_forest">Isolation Forest (Tree Ensemble ML)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400 font-medium">Cutoff:</span>
                <input
                  type="range"
                  min="1.5"
                  max="4.0"
                  step="0.1"
                  value={sensitivity}
                  onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
                  className="w-32 h-2 bg-surface-800 rounded appearance-none cursor-pointer accent-primary-500"
                />
                <span className="text-xs font-mono font-bold text-primary-400 w-10">
                  {sensitivity.toFixed(1)}σ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              All Outliers ({anomalies.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'pending'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/25'
                  : 'bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('flagged')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'flagged'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              Flagged ({flaggedCount})
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              Verified Safe ({verifiedCount})
            </button>
          </div>

          <div className="text-xs text-surface-400">
            Algorithm: <span className="text-surface-200 font-semibold">{anomalies[0]?.algorithm || selectedAlgo}</span>
          </div>
        </div>

        {/* Loading State Skeleton */}
        {loading ? (
          <div className="space-y-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="section-card p-6 animate-pulse bg-surface-900/60">
                <div className="h-4 bg-surface-700/50 rounded w-1/4 mb-3" />
                <div className="h-6 bg-surface-700/50 rounded w-1/2 mb-2" />
                <div className="h-4 bg-surface-700/50 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredAnomalies.length === 0 ? (
          /* Empty State */
          <div className="section-card text-center py-16 mb-8 border-dashed border-surface-700/80">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-3xl flex items-center justify-center mx-auto mb-4">
              ✨
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              No Statistical Outliers Found
            </h3>
            <p className="text-surface-400 text-sm max-w-md mx-auto mb-6">
              All transactions fall within normal statistical parameters at sensitivity {sensitivity.toFixed(1)}σ.
              You can lower the sensitivity slider or inject a sample spike to test live detection.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleSensitivityChange(1.8)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Lower Cutoff to 1.8σ
              </button>
              <button
                onClick={handleSimulateSpike}
                disabled={simulating}
                className="btn-primary text-xs py-2 px-4 shadow-glow"
              >
                {simulating ? 'Injecting...' : '⚡ Simulate Live Spike'}
              </button>
            </div>
          </div>
        ) : (
          /* Live Dynamic Anomaly Cards */
          <div className="space-y-6 mb-8">
            {filteredAnomalies.map((anom) => {
              const isResolved = anom.status === 'verified';
              const isFlagged = anom.status === 'flagged';

              return (
                <div
                  key={anom.id}
                  className={`section-card relative transition-all duration-300 ${
                    isResolved
                      ? 'opacity-60 border-surface-700/50'
                      : isFlagged
                      ? 'border-rose-600/60 bg-rose-950/20 shadow-lg shadow-rose-950/30'
                      : 'border-rose-500/40 bg-gradient-to-r from-rose-950/20 via-surface-900 to-surface-900'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Left: Outlier Information */}
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-3xl flex-shrink-0 shadow-lg ${
                        anom.severity === 'critical'
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                          : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      }`}>
                        ⚠️
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                            anom.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {anom.severity} anomaly
                          </span>
                          <span className="text-xs text-surface-400 font-medium">{anom.date}</span>
                          <span className="text-xs text-surface-600">•</span>
                          <span className="badge-info text-xs">{anom.category}</span>
                          <span className="text-xs text-surface-600">•</span>
                          <span className="text-[11px] font-mono text-surface-400">
                            ID #{anom.transaction_id}
                          </span>
                        </div>

                        <h3 className="text-2xl font-black text-white tracking-tight">
                          ₹{fmt(anom.amount)}{' '}
                          <span className="text-sm font-normal text-surface-300">
                            at {anom.merchant}
                          </span>
                        </h3>

                        <p className="text-surface-300 text-sm mt-2 max-w-xl leading-relaxed">
                          {anom.reason}
                        </p>
                      </div>
                    </div>

                    {/* Right: Persistent Audit Actions */}
                    <div className="flex sm:flex-col items-center justify-end gap-2.5 flex-shrink-0 min-w-[170px]">
                      {anom.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleAction(anom, 'verified')}
                            className="w-full btn-secondary text-xs py-2 px-3 whitespace-nowrap hover:border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-1"
                          >
                            <span>✓</span> Mark Verified (Safe)
                          </button>
                          <button
                            onClick={() => handleAction(anom, 'flagged')}
                            className="w-full btn-danger text-xs py-2 px-3 whitespace-nowrap flex items-center justify-center gap-1"
                          >
                            <span>🚨</span> Flag For Review
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-end gap-1.5 w-full">
                          <span className={`text-xs font-mono font-semibold px-3 py-1.5 rounded-lg w-full text-center ${
                            isResolved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}>
                            {isResolved ? '✓ Verified Safe' : '🚨 Flagged Suspicious'}
                          </span>
                          <button
                            onClick={() => handleAction(anom, isResolved ? 'flagged' : 'verified')}
                            className="text-[11px] text-surface-400 hover:text-surface-200 underline"
                          >
                            Switch to {isResolved ? 'Flagged' : 'Verified'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Statistical Algorithm Insights Guide */}
        <div className="section-card bg-surface-900/60">
          <h2 className="section-title">
            <span>ℹ️</span> How FinSight IQ Computes Dynamic Anomalies
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-surface-300">
            <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/40">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📈</span>
                <p className="font-bold text-surface-100">1. Gaussian Z-Scores</p>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">
                Computes category rolling sample mean (μ) and standard deviation (σ). If an outlay fulfills |x - μ| &ge; {sensitivity.toFixed(1)}σ, the model triggers an alert. Best for symmetrical Gaussian distributions.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/40">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📊</span>
                <p className="font-bold text-surface-100">2. Tukey's Interquartile Range</p>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">
                Tukey fences calculate Q1 (25th percentile) and Q3 (75th percentile) with IQR boundaries. Resilient against heavy right-skewed discretionary expenses like Shopping or Travel.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-800/40 border border-surface-700/40">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌲</span>
                <p className="font-bold text-surface-100">3. Isolation Forest Ensemble</p>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">
                Scikit-Learn tree ensemble isolates outliers by partitioning multidimensional feature space (amount, weekday, day of month, category code). Anomalous points require fewer tree splits to isolate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Anomalies;
