import React, { useState, useEffect, useMemo } from 'react';
import { transactionsApi, type Transaction } from '../services/api';

const categoryOptions = [
  'Food & Dining', 'Transportation', 'Entertainment', 'Utilities',
  'Shopping', 'Healthcare', 'Education', 'Rent', 'Salary',
  'Freelance', 'Investment', 'Travel', 'Bills', 'Others',
];
const paymentModes = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet'];

const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving,  setSaving]      = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg,   setErrorMsg]   = useState('');

  // Form state
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<number | null>(null);
  const [type,         setType]         = useState<'income' | 'expense'>('expense');
  const [category,     setCategory]     = useState('');
  const [paymentMode,  setPaymentMode]  = useState('');
  const [date,         setDate]         = useState('');
  const [description,  setDescription]  = useState('');
  const [amount,       setAmount]       = useState('');

  // Filter/Search state
  const [searchTerm,      setSearchTerm]      = useState('');
  const [filterType,      setFilterType]      = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory,  setFilterCategory]  = useState('all');
  const [filterDateFrom,  setFilterDateFrom]  = useState('');
  const [filterDateTo,    setFilterDateTo]    = useState('');
  const [sortBy,          setSortBy]          = useState<'date' | 'amount'>('date');
  const [sortOrder,       setSortOrder]       = useState<'asc' | 'desc'>('desc');

  /* ── Fetch from API ── */
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionsApi.list({ limit: 500 });
      setTransactions(data.map(t => ({ ...t, amount: Number(t.amount) })));
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransactions(); }, []);

  /* ── Toast helpers ── */
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const resetForm = () => {
    setType('expense'); setCategory(''); setPaymentMode('');
    setDate(''); setDescription(''); setAmount('');
    setEditId(null); setShowForm(false);
  };

  /* ── Submit (Create or Update) ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        type, category, payment_mode: paymentMode,
        date, description, amount: parseFloat(amount), source: 'ui' as const,
      };
      if (editId !== null) {
        const updated = await transactionsApi.update(editId, payload);
        setTransactions(prev => prev.map(t => t.id === editId ? { ...updated, amount: Number(updated.amount) } : t));
        showSuccess('Transaction updated successfully!');
      } else {
        const created = await transactionsApi.create(payload);
        setTransactions(prev => [{ ...created, amount: Number(created.amount) }, ...prev]);
        showSuccess('Transaction added successfully!');
      }
      resetForm();
    } catch (e: any) {
      showError(e.message || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tx: Transaction) => {
    setEditId(tx.id); setType(tx.type); setCategory(tx.category);
    setPaymentMode(tx.payment_mode); setDate(tx.date);
    setDescription(tx.description); setAmount(tx.amount.toString());
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteTx = async (id: number) => {
    try {
      await transactionsApi.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      showSuccess('Transaction deleted!');
    } catch (e: any) {
      showError(e.message || 'Failed to delete transaction');
    }
  };

  /* ── Filtered & sorted transactions ── */
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(tx =>
        tx.description.toLowerCase().includes(term) ||
        tx.category.toLowerCase().includes(term) ||
        tx.payment_mode.toLowerCase().includes(term)
      );
    }
    if (filterType !== 'all')     result = result.filter(tx => tx.type === filterType);
    if (filterCategory !== 'all') result = result.filter(tx => tx.category === filterCategory);
    if (filterDateFrom)           result = result.filter(tx => tx.date >= filterDateFrom);
    if (filterDateTo)             result = result.filter(tx => tx.date <= filterDateTo);
    result.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      } else {
        return sortOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
    });
    return result;
  }, [transactions, searchTerm, filterType, filterCategory, filterDateFrom, filterDateTo, sortBy, sortOrder]);

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">💳 Transactions</h1>
            <p className="page-subtitle">
              Manage your daily income and expenses
              {!loading && <span className="ml-2 text-xs text-primary-400">({transactions.length} records in MySQL)</span>}
            </p>
          </div>
          <button
            className="btn-primary mt-4 sm:mt-0"
            onClick={() => { resetForm(); setShowForm(!showForm); }}
          >
            {showForm ? '✕ Close Form' : '+ Add Transaction'}
          </button>
        </div>

        {/* ── Toasts ── */}
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-medium text-sm animate-slide-down flex items-center gap-3">
            <span className="text-lg">✅</span> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-medium text-sm flex items-center gap-3">
            <span className="text-lg">⚠️</span> {errorMsg}
          </div>
        )}

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-lg">↗</div>
            <div>
              <p className="text-surface-400 text-xs font-medium">Total Income</p>
              <p className="text-emerald-400 font-bold text-lg">₹{totalIncome.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-lg">↘</div>
            <div>
              <p className="text-surface-400 text-xs font-medium">Total Expenses</p>
              <p className="text-rose-400 font-bold text-lg">₹{totalExpense.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center text-lg">📊</div>
            <div>
              <p className="text-surface-400 text-xs font-medium">Transactions</p>
              <p className="text-primary-400 font-bold text-lg">{transactions.length}</p>
            </div>
          </div>
        </div>

        {/* ── Add/Edit Form ── */}
        {showForm && (
          <div className="section-card animate-scale-in mb-8">
            <h2 className="section-title">
              <span>{editId ? '✏️' : '➕'}</span> {editId ? 'Edit Transaction' : 'New Transaction'}
            </h2>
            <form onSubmit={handleSubmit}>
              {/* Type Toggle */}
              <div className="flex gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                    type === 'expense'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-lg shadow-rose-500/10'
                      : 'bg-surface-800/50 border-surface-700/50 text-surface-400 hover:text-surface-300'
                  }`}
                >
                  ↘ Expense
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 border ${
                    type === 'income'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10'
                      : 'bg-surface-800/50 border-surface-700/50 text-surface-400 hover:text-surface-300'
                  }`}
                >
                  ↗ Income
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 font-semibold">₹</span>
                    <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="form-input pl-10 text-lg font-semibold" required />
                  </div>
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="form-select" required>
                    <option value="" disabled>Select a category</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Mode</label>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="form-select" required>
                    <option value="" disabled>Select payment mode</option>
                    {paymentModes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="form-label">Description</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Monthly groceries" className="form-input" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '⏳ Saving...' : `💾 ${editId ? 'Update' : 'Save'} Transaction`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Search & Filter Bar ── */}
        <div className="section-card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">🔍</span>
                <input
                  type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search transactions..." className="form-input pl-12"
                />
              </div>
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="form-select">
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="form-select">
              <option value="all">All Categories</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="text-xs text-surface-500 mb-1 block">From Date</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="form-input text-sm" />
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">To Date</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="form-input text-sm" />
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Sort By</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="form-select text-sm">
                <option value="date">Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Order</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="form-select text-sm">
                <option value="desc">Newest / Highest First</option>
                <option value="asc">Oldest / Lowest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Transactions Table ── */}
        <div className="section-card animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title mb-0">
              <span>📋</span> Transactions ({filteredTransactions.length})
            </h2>
            {(searchTerm || filterType !== 'all' || filterCategory !== 'all' || filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setSearchTerm(''); setFilterType('all'); setFilterCategory('all'); setFilterDateFrom(''); setFilterDateTo(''); }}
                className="text-sm text-primary-400 hover:text-primary-300 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-surface-400 text-sm">Loading from database...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-surface-400 font-medium">No transactions found</p>
              <p className="text-surface-500 text-sm mt-1">Try adjusting your filters or add a new transaction</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-surface-400 text-left border-b border-surface-700/50">
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Description</th>
                    <th className="pb-3 pr-4 font-semibold">Category</th>
                    <th className="pb-3 pr-4 font-semibold">Type</th>
                    <th className="pb-3 pr-4 font-semibold">Payment</th>
                    <th className="pb-3 pr-4 font-semibold">Source</th>
                    <th className="pb-3 pr-4 font-semibold text-right">Amount</th>
                    <th className="pb-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id} className="border-b border-surface-700/20 hover:bg-surface-800/30 transition-colors">
                      <td className="py-3 pr-4 text-surface-300">{tx.date}</td>
                      <td className="py-3 pr-4 text-surface-200 font-medium">{tx.description || '—'}</td>
                      <td className="py-3 pr-4"><span className="badge-info">{tx.category}</span></td>
                      <td className="py-3 pr-4">
                        <span className={tx.type === 'income' ? 'badge-success' : 'badge-danger'}>
                          {tx.type === 'income' ? '↗ Income' : '↘ Expense'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-surface-400">{tx.payment_mode}</td>
                      <td className="py-3 pr-4">
                        <span className="text-xs text-surface-500 font-mono bg-surface-800 px-2 py-0.5 rounded">{tx.source}</span>
                      </td>
                      <td className={`py-3 pr-4 text-right font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEdit(tx)} className="text-surface-500 hover:text-primary-400 transition-colors" title="Edit">✏️</button>
                          <button onClick={() => deleteTx(tx.id)} className="text-surface-500 hover:text-rose-400 transition-colors" title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
