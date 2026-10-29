import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi, type MonthlyPoint, type CategoryPoint, type PaymentMethodPoint } from '../services/api';

/* ── Helpers ── */
const fmt = (n: number) => n.toLocaleString('en-IN');

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 shadow-xl" style={{ fontSize: '13px' }}>
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

const Skeleton = ({ h = '300px' }: { h?: string }) => (
  <div style={{ height: h }} className="w-full bg-surface-700/50 animate-pulse rounded-xl" />
);

const Analytics: React.FC = () => {
  const [period, setPeriod] = useState<'6M' | '1Y' | 'All'>('6M');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [categories, setCategories] = useState<CategoryPoint[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodPoint[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const monthsCount = period === '6M' ? 6 : period === '1Y' ? 12 : 24;
      const [monData, catData, pmData] = await Promise.all([
        analyticsApi.monthly(monthsCount),
        analyticsApi.categories(),
        analyticsApi.paymentMethods(),
      ]);
      setMonthly(monData);
      setCategories(catData);
      setPaymentMethods(pmData);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [period]);

  const totalIncome = monthly.reduce((acc, curr) => acc + curr.income, 0);
  const totalExpense = monthly.reduce((acc, curr) => acc + curr.expense, 0);
  const savingsRate = totalIncome ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
          <div>
            <h1 className="page-title">📈 Deep Analytics</h1>
            <p className="page-subtitle">Understand your financial patterns and behaviors</p>
          </div>
          <div className="mt-4 sm:mt-0 bg-surface-800 p-1 rounded-xl border border-surface-700/50 inline-flex">
            {['6M', '1Y', 'All'].map((p) => (
              <button
                key={p}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  period === p ? 'bg-primary-500 text-white shadow-md' : 'text-surface-400 hover:text-surface-200'
                }`}
                onClick={() => setPeriod(p as any)}
              >
                {p === 'All' ? 'All Time' : `Past ${p}`}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* ── Summary Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-surface-400 text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="text-lg">💰</span> Total Inflow ({period})
            </h3>
            {loading ? <Skeleton h="2rem" /> : (
              <p className="text-3xl font-bold text-emerald-400">₹{fmt(totalIncome)}</p>
            )}
          </div>
          <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-surface-400 text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="text-lg">🛒</span> Total Outflow ({period})
            </h3>
            {loading ? <Skeleton h="2rem" /> : (
              <p className="text-3xl font-bold text-rose-400">₹{fmt(totalExpense)}</p>
            )}
          </div>
          <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-surface-400 text-sm font-semibold mb-2 flex items-center gap-2">
              <span className="text-lg">🏦</span> Avg. Savings Rate
            </h3>
            {loading ? <Skeleton h="2rem" /> : (
              <p className="text-3xl font-bold text-primary-400">{savingsRate}%</p>
            )}
          </div>
        </div>

        {/* ── Cash Flow Area Chart ── */}
        <div className="section-card mb-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="section-title"><span>🌊</span> Cash Flow Dynamics</h2>
          <div style={{ height: '320px' }}>
            {loading ? <Skeleton h="320px" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInc)" />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Breakdowns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Category Bar Chart */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <h2 className="section-title"><span>📂</span> Spending by Category</h2>
            <div style={{ height: '300px' }}>
              {loading ? <Skeleton h="300px" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
                    <YAxis type="category" dataKey="name" stroke="#cbd5e1" fontSize={12} width={100} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                      {categories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Payment Method Pie Chart */}
          <div className="section-card animate-slide-up" style={{ animationDelay: '0.6s' }}>
            <h2 className="section-title"><span>💳</span> Payment Methods</h2>
            <div className="flex h-[300px] items-center">
              {loading ? <Skeleton h="300px" /> : (
                <>
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethods}
                        cx="50%" cy="50%"
                        innerRadius={50} outerRadius={90}
                        paddingAngle={4} dataKey="value"
                      >
                        {paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                        contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-1/2 space-y-3">
                    {paymentMethods.map((pm, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pm.color }} />
                          <span className="text-surface-200 text-sm font-medium">{pm.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-surface-100 font-bold">{pm.percentage}%</p>
                          <p className="text-xs text-surface-500">₹{fmt(pm.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;
