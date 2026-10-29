// frontend/src/pages/Budgets.tsx
import React, { useState, useEffect } from 'react';
import { budgetsApi, type Budget } from '../services/api';

const categoryIcons: Record<string, string> = {
  'Food & Dining':      '🍔',
  'Travel':             '✈️',
  'Shopping':           '🛍️',
  'Bills':              '💡',
  'Bills & Utilities':  '💡',
  'Utilities':          '💡',
  'Entertainment':      '🎬',
  'Healthcare':         '💊',
  'Education':          '📚',
  'Rent':               '🏠',
  'Salary':             '💰',
  'Freelance':          '💻',
  'Investment':         '📈',
  'Others':             '🏷️',
};

const categoryColors: Record<string, string> = {
  'Food & Dining':      '#f43f5e',
  'Travel':             '#f59e0b',
  'Shopping':           '#8b5cf6',
  'Bills':              '#0ea5e9',
  'Bills & Utilities':  '#0ea5e9',
  'Utilities':          '#0ea5e9',
  'Entertainment':      '#10b981',
  'Healthcare':         '#ec4899',
  'Education':          '#14b8a6',
  'Rent':               '#6366f1',
  'Others':             '#64748b',
};

const availableCategories = [
  'Food & Dining', 'Travel', 'Shopping', 'Bills', 'Entertainment',
  'Healthcare', 'Education', 'Rent', 'Investment', 'Others'
];

const Budgets: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState<number>(now.getFullYear());

  // Editing state
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [editAmount, setEditAmount]   = useState<string>('');
  const [savingEdit, setSavingEdit]   = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName]     = useState('Food & Dining');
  const [newCatLimit, setNewCatLimit]   = useState('');
  const [addingBudget, setAddingBudget] = useState(false);

  const fetchBudgets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await budgetsApi.list({ month: selectedMonth, year: selectedYear });
      setBudgets(data.map(b => ({
        ...b,
        amount: Number(b.amount),
        spent: Number(b.spent || 0)
      })));
    } catch (e: any) {
      setError(e.message || 'Failed to load budgets from MySQL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [selectedMonth, selectedYear]);

  const showToast = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const totalBudget = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalSpent  = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalUsagePct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const exceededBudgets = budgets.filter(b => b.spent > b.amount);

  const startEdit = (b: Budget) => {
    setEditingId(b.id);
    setEditAmount(b.amount.toString());
  };

  const saveEdit = async (id: number) => {
    const val = parseFloat(editAmount);
    if (isNaN(val) || val <= 0) return;

    setSavingEdit(true);
    try {
      const updated = await budgetsApi.update(id, { amount: val });
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, amount: Number(updated.amount) } : b));
      showToast('Budget ceiling updated!');
      setEditingId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to update budget');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(newCatLimit);
    if (!newCatName || isNaN(limit) || limit <= 0) return;

    setAddingBudget(true);
    try {
      const created = await budgetsApi.create({
        category: newCatName,
        amount: limit,
        month: selectedMonth,
        year: selectedYear,
      });

      // Refresh list to update spent calculations from MySQL
      await fetchBudgets();
      showToast(`Budget for ${newCatName} saved to MySQL!`);
      setNewCatLimit('');
      setShowAddModal(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save new budget to MySQL');
    } finally {
      setAddingBudget(false);
    }
  };

  const handleDeleteBudget = async (id: number, catName: string) => {
    if (!confirm(`Delete the budget for ${catName}?`)) return;
    try {
      await budgetsApi.delete(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
      showToast('Budget removed');
    } catch (e: any) {
      setError(e.message || 'Failed to delete budget');
    }
  };

  const monthOptions = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">🎯 Budget Management</h1>
            <p className="page-subtitle">Track targets and monitor category spending thresholds in real-time (MySQL Synced)</p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="form-select text-sm py-2"
            >
              {monthOptions.map(m => (
                <option key={m.num} value={m.num}>{m.name} {selectedYear}</option>
              ))}
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary text-sm whitespace-nowrap"
            >
              + Set New Budget
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-slide-down">
            <span className="text-xl">✅</span> {success}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center gap-3 animate-slide-down">
            <span className="text-xl">⚠️</span> {error}
          </div>
        )}

        {/* Exceeded Alerts Banner */}
        {exceededBudgets.length > 0 && (
          <div className="mb-8 space-y-3">
            {exceededBudgets.map(b => {
              const diff = b.spent - b.amount;
              return (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between animate-slide-down shadow-lg shadow-rose-500/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-bold text-rose-300 text-sm sm:text-base">
                        {b.category} budget exceeded by ₹{diff.toLocaleString('en-IN')}!
                      </p>
                      <p className="text-xs text-rose-400/80">
                        Spent ₹{b.spent.toLocaleString('en-IN')} against your planned limit of ₹{b.amount.toLocaleString('en-IN')} ({Math.round((b.spent / b.amount) * 100)}% utilized)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(b)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-500/40 transition-colors"
                  >
                    Adjust Budget
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Aggregate Overview Card */}
        <div className="section-card mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-surface-700/50">
            <div>
              <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider">Overall Monthly Budget</p>
              <h2 className="text-3xl font-extrabold text-white mt-1">
                ₹{totalSpent.toLocaleString('en-IN')}{' '}
                <span className="text-surface-400 text-lg font-normal">/ ₹{totalBudget.toLocaleString('en-IN')}</span>
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-surface-400 uppercase">Remaining Pool</p>
                <p className={`text-xl font-bold ${totalBudget - totalSpent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{Math.abs(totalBudget - totalSpent).toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-surface-400">{totalBudget - totalSpent >= 0 ? 'left' : 'over'}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-400 uppercase">Total Utilization</p>
                <p className="text-xl font-bold text-primary-300">{totalUsagePct}%</p>
              </div>
            </div>
          </div>

          {/* Master Progress Bar */}
          <div className="mt-6">
            <div className="w-full h-3.5 bg-surface-800 rounded-full overflow-hidden p-0.5 border border-surface-700/60">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  totalUsagePct > 100
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                    : totalUsagePct > 80
                    ? 'bg-gradient-to-r from-primary-500 to-amber-500'
                    : 'bg-gradient-to-r from-emerald-500 to-primary-500'
                }`}
                style={{ width: `${Math.min(totalUsagePct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-surface-400 text-sm">Fetching user budgets from MySQL...</p>
          </div>
        ) : budgets.length === 0 ? (
          <div className="section-card text-center py-16">
            <p className="text-4xl mb-3">🎯</p>
            <h3 className="text-lg font-bold text-white mb-1">No Budgets Configured Yet</h3>
            <p className="text-surface-400 text-sm max-w-md mx-auto mb-6">
              Create category spending targets to monitor your monthly expenses and avoid overspending.
            </p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
              + Set First Category Budget
            </button>
          </div>
        ) : (
          /* Category Budget Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgets.map((b) => {
              const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
              const isExceeded = b.spent > b.amount;
              const isEditing = editingId === b.id;
              const icon = categoryIcons[b.category] || '🏷️';
              const color = categoryColors[b.category] || '#6366f1';

              return (
                <div
                  key={b.id}
                  className={`section-card relative overflow-hidden transition-all duration-300 ${
                    isExceeded ? 'border-rose-500/40 bg-rose-950/10' : 'hover:border-surface-600/70'
                  }`}
                >
                  {/* Top color indicator stripe */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: isExceeded ? '#f43f5e' : color }}
                  />

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 rounded-xl bg-surface-800/80 border border-surface-700/50">
                        {icon}
                      </span>
                      <div>
                        <h3 className="font-bold text-surface-100 text-base">{b.category}</h3>
                        <p className="text-xs text-surface-400">Monthly Ceiling</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExceeded ? (
                        <span className="badge-danger font-mono text-xs">Exceeded</span>
                      ) : pct >= 80 ? (
                        <span className="badge-warning font-mono text-xs">Caution</span>
                      ) : (
                        <span className="badge-success font-mono text-xs">On Track</span>
                      )}
                      <button
                        onClick={() => handleDeleteBudget(b.id, b.category)}
                        className="text-surface-500 hover:text-rose-400 text-xs p-1"
                        title="Delete Budget"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Amount display / edit field */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-2xl font-bold text-white">
                        ₹{b.spent.toLocaleString('en-IN')}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-surface-400">₹</span>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-24 px-2 py-1 text-sm bg-surface-800 border border-primary-500 rounded text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(b.id)}
                            disabled={savingEdit}
                            className="text-xs px-2 py-1 bg-primary-600 rounded text-white hover:bg-primary-500"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-surface-700 rounded text-surface-300 hover:bg-surface-600"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(b)}
                          className="text-sm font-semibold text-surface-400 hover:text-primary-300 transition-colors flex items-center gap-1"
                          title="Click to edit budget amount"
                        >
                          / ₹{b.amount.toLocaleString('en-IN')}{' '}
                          <span className="text-xs opacity-60">✏️</span>
                        </button>
                      )}
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-3 bg-surface-800/80 rounded-full overflow-hidden border border-surface-700/40 mt-3">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isExceeded
                            ? 'bg-rose-500'
                            : pct >= 80
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2">
                      <span className="text-surface-400">
                        {isExceeded
                          ? `Over by ₹${(b.spent - b.amount).toLocaleString('en-IN')}`
                          : `₹${(b.amount - b.spent).toLocaleString('en-IN')} available`}
                      </span>
                      <span className={`font-bold font-mono ${isExceeded ? 'text-rose-400' : 'text-surface-300'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Set New Budget */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="section-card w-full max-w-md animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Set Category Budget</h3>
                <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={handleAddBudget} className="space-y-4">
                <div>
                  <label className="form-label">Category Name</label>
                  <select
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="form-select"
                    required
                  >
                    {availableCategories.map(c => (
                      <option key={c} value={c}>{categoryIcons[c] || '🏷️'} {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Monthly Limit (₹)</label>
                  <input
                    type="number"
                    value={newCatLimit}
                    onChange={(e) => setNewCatLimit(e.target.value)}
                    placeholder="5000"
                    className="form-input"
                    required
                    min="100"
                    step="50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={addingBudget} className="btn-primary text-sm flex items-center gap-2">
                    {addingBudget ? '⏳ Saving...' : '💾 Save to MySQL'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Budgets;
