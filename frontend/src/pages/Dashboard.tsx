import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  analyticsApi,
  budgetsApi,
  type KPIs, type MonthlyPoint, type CategoryPoint, type Transaction, type AnomalyItem,
} from '../services/api';

/* ─── Helpers ─────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('en-IN');

const getCategoryColors = (categories: CategoryPoint[]) => {
  const names = [...new Set(categories.map(category => category.name))].sort((a, b) => a.localeCompare(b));
  return new Map(
    names.map((name, index) => [
      name,
      `hsl(${Math.round(index * 360 / names.length)}, 75%, 58%)`,
    ])
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3" style={{ fontSize: '13px' }}>
        <p className="text-surface-300 font-semibold mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="font-medium">
            {entry.name}: ₹{entry.value?.toLocaleString('en-IN')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/* ─── Skeleton loader ─────────────────────────── */
const Skeleton = ({ w = '100%', h = '1.2rem' }: { w?: string; h?: string }) => (
  <div
    style={{ width: w, height: h, borderRadius: '6px' }}
    className="bg-surface-700/50 animate-pulse"
  />
);

/* ─── KPI config ──────────────────────────────── */
const KPI_META = [
  { key: 'income',       label: 'Total Income',    icon: '💰', from: '#10b981', to: '#34d399' },
  { key: 'expense',      label: 'Total Expenses',   icon: '🛒', from: '#f43f5e', to: '#fb7185' },
  { key: 'savings',      label: 'Total Savings',    icon: '🏦', from: '#0ea5e9', to: '#38bdf8' },
  { key: 'savings_rate', label: 'Savings Rate',     icon: '📈', from: '#6366f1', to: '#818cf8', pct: true },
 
 
] as const;

/* ─── Dashboard Page ──────────────────────────── */
const Dashboard: React.FC = () => {
  const [chartPeriod, setChartPeriod] = useState('6M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [kpis,           setKpis]           = useState<KPIs | null>(null);
  const [monthly,        setMonthly]        = useState<MonthlyPoint[]>([]);
  const [categories,     setCategories]     = useState<CategoryPoint[]>([]);
  const [recent,         setRecent]         = useState<Transaction[]>([]);
  const [userBudgets,    setUserBudgets]    = useState<{ category: string; amount: number; spent: number }[]>([]);
  const [liveAnomalies,  setLiveAnomalies]  = useState<AnomalyItem[]>([]);
  const categoryColors = getCategoryColors(categories);

  // Derived savings data from monthly
  const savingsData = monthly.map(m => ({ month: m.month, savings: m.savings }));

  // Budget vs Actual from live MySQL budgets or category spend
  const budgetData = userBudgets.length > 0
    ? userBudgets.slice(0, 5).map(b => ({
        category: b.category,
        actual: b.spent,
        budget: b.amount,
      }))
    : categories.slice(0, 5).map(c => ({
        category: c.name,
        actual: c.value,
        budget: Math.round(c.value * 1.2),
      }));

  const periodToMonths: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const months = periodToMonths[chartPeriod] || 6;
      const [kpisData, monthlyData, catsData, recentData, budgetsList, anomalyData] = await Promise.all([
        analyticsApi.kpis(),
        analyticsApi.monthly(months),
        analyticsApi.categories(),
        analyticsApi.recent(5),
        budgetsApi.list().catch(() => []),
        analyticsApi.anomalies({ algorithm: 'zscore', threshold: 2.5 }).catch(() => ({ anomalies: [], metrics: null })),
      ]);
      setKpis(kpisData);
      setMonthly(monthlyData);
      setCategories(catsData);
      setRecent(recentData);
      setUserBudgets(budgetsList.map(b => ({ category: b.category, amount: Number(b.amount), spent: Number(b.spent || 0) })));
      setLiveAnomalies((anomalyData.anomalies || []).filter((a: AnomalyItem) => a.status === 'pending'));
    } catch (e: any) {
      setError(e.message || 'Failed to load data from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [chartPeriod]);

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* ── Header Section ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your financial overview at a glance</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <div className="tab-group">
              {['1M', '3M', '6M', '1Y'].map(p => (
                <button
                  key={p}
                  className={`tab-item ${chartPeriod === p ? 'active' : ''}`}
                  onClick={() => setChartPeriod(p)}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  {p}
                </button>
              ))}
            </div>
            <Link to="/transactions" className="btn-primary text-center text-sm">
              + Add Transaction
            </Link>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium flex items-center gap-3">
            <span>⚠️</span> {error} — make sure the backend is running on port 8000.
          </div>
        )}

        {/* ── Live Anomaly Alert Banner ── */}
        {!loading && liveAnomalies.length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-rose-950/60 via-rose-900/20 to-surface-900 border border-rose-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-rose-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xl flex-shrink-0">
                🚨
              </div>
              <div>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
                  {liveAnomalies.length} Live Statistical Outlier{liveAnomalies.length > 1 ? 's' : ''} Detected
                </p>
                <p className="text-xs text-rose-300/80 mt-0.5">
                  ₹{liveAnomalies.reduce((s, a) => s + a.amount, 0).toLocaleString('en-IN')} total exposure · Z-Score algorithm · Pending audit review
                </p>
              </div>
            </div>
            <Link
              to="/anomalies"
              className="btn-danger text-xs py-2 px-4 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5"
            >
              <span>🔍</span> Review Anomalies
            </Link>
          </div>
        )}

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {KPI_META.map((meta, i) => {
            const rawVal = kpis ? (kpis[meta.key] as number) : null;
            const display = rawVal === null
              ? null
              : meta.pct
                ? `${rawVal.toFixed(1)}%`
                : `₹${fmt(Math.round(rawVal))}`;

            return (
              <div
                key={i}
                className="kpi-card animate-slide-up"
                style={{
                  '--kpi-color-from': meta.from,
                  '--kpi-color-to':   meta.to,
                  animationDelay: `${i * 0.08}s`,
                  animationFillMode: 'backwards',
                } as React.CSSProperties}
              >
                <div className="kpi-icon" style={{ background: `linear-gradient(135deg, ${meta.from}20, ${meta.to}10)` }}>
                  {meta.icon}
                </div>
                <p className="kpi-label">{meta.label}</p>
                {loading
                  ? <Skeleton h="1.8rem" />
                  : <p className="kpi-value" style={{ fontSize: '1.5rem' }}>{display}</p>
                }
              </div>
            );
          })}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Income vs Expense Bar Chart */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}>
            <h2 className="section-title"><span>📊</span> Income vs Expense</h2>
            <div style={{ height: '300px' }}>
              {loading ? <Skeleton h="300px" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="income"  name="Income"  fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Expense by Category Donut */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.6s', animationFillMode: 'backwards' }}>
            <h2 className="section-title"><span>🍩</span> Expense by Category</h2>
            <div style={{ height: '300px' }} className="flex items-center">
              {loading ? <Skeleton h="300px" /> : (
                <>
                  <ResponsiveContainer width="55%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={100}
                        paddingAngle={3} dataKey="value"
                      >
                        {categories.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={categoryColors.get(entry.name) ?? entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '13px' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {categories.map((cat, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColors.get(cat.name) ?? cat.color }} />
                        <span className="text-surface-300 flex-1">{cat.name}</span>
                        <span className="text-surface-400 font-medium">₹{fmt(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Savings Trend */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.7s', animationFillMode: 'backwards' }}>
            <h2 className="section-title"><span>📈</span> Savings Trend</h2>
            <div style={{ height: '280px' }}>
              {loading ? <Skeleton h="280px" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={savingsData}>
                    <defs>
                      <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="savings" name="Savings" stroke="#6366f1" fill="url(#savingsGrad)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Budget vs Actual */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.8s', animationFillMode: 'backwards' }}>
            <h2 className="section-title"><span>📊</span> Budget vs Actual Spending</h2>
            <div style={{ height: '280px' }}>
              {loading ? <Skeleton h="280px" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetData} layout="vertical" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <YAxis type="category" dataKey="category" stroke="#64748b" fontSize={12} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="budget" name="Budget" fill="#334155" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ── Trend + Recent Transactions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Income/Expense Trend */}
          <div className="lg:col-span-2 section-card animate-slide-up" style={{ animationDelay: '0.9s', animationFillMode: 'backwards' }}>
            <h2 className="section-title"><span>📈</span> Income / Expense Trend</h2>
            <div style={{ height: '280px' }}>
              {loading ? <Skeleton h="280px" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="income"  name="Income"  stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '1.0s', animationFillMode: 'backwards' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="section-title mb-0"><span>📋</span> Recent</h2>
              <Link to="/transactions" className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-medium">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="3rem" />)
                : recent.map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-800/40 border border-surface-700/30 hover:border-surface-600/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                        tx.type === 'income' ? 'bg-emerald-500/15' : 'bg-rose-500/15'
                      }`}>
                        {tx.type === 'income' ? '↗' : '↘'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-100">{tx.description || tx.category}</p>
                        <p className="text-xs text-surface-500">{tx.date}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'income' ? '+' : '-'}₹{fmt(tx.amount)}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
