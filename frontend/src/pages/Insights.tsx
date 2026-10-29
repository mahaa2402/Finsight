import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { budgetsApi, transactionsApi, type Budget, type Transaction } from '../services/api';

interface InsightCard {
  id: string;
  type: 'tip' | 'alert' | 'target' | 'trend';
  icon: string;
  title: string;
  description: string;
  impact: string;
  actionText?: string;
  category: 'Spending' | 'Budget' | 'Savings' | 'Patterns';
  priority: 'high' | 'medium' | 'low';
}

const currency = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`;
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function buildInsights(transactions: Transaction[], budgets: Budget[], now: Date): InsightCard[] {
  const currentKey = monthKey(now);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  const current = transactions.filter(tx => tx.date.startsWith(currentKey));
  const previous = transactions.filter(tx => tx.date.startsWith(previousKey));
  const expenses = current.filter(tx => tx.type === 'expense');
  const incomeTotal = current.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenseTotal = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const previousExpenseTotal = previous
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const categoryTotals = new Map<string, number>();
  expenses.forEach(tx => categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + Number(tx.amount)));
  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const insights: InsightCard[] = [];

  if (previousExpenseTotal > 0 && expenseTotal > 0) {
    const change = ((expenseTotal - previousExpenseTotal) / previousExpenseTotal) * 100;
    if (Math.abs(change) >= 10) {
      const increased = change > 0;
      insights.push({
        id: 'monthly-expense-trend',
        type: increased ? 'alert' : 'trend',
        icon: increased ? '⚠️' : '📉',
        title: increased ? 'Monthly spending increased' : 'Monthly spending decreased',
        description: `Your expenses this month are ${Math.abs(change).toFixed(0)}% ${increased ? 'higher' : 'lower'} than last month (${currency(expenseTotal)} vs ${currency(previousExpenseTotal)}).`,
        impact: `${increased ? '+' : '-'}${currency(Math.abs(expenseTotal - previousExpenseTotal))} vs last month`,
        category: 'Spending',
        priority: increased ? 'high' : 'medium',
        actionText: 'Review Transactions',
      });
    }
  }

  if (topCategory) {
    insights.push({
      id: 'top-spending-category',
      type: 'tip',
      icon: '📊',
      title: `Top spending: ${topCategory[0]}`,
      description: `${topCategory[0]} is your largest expense category this month, with ${currency(topCategory[1])} across ${expenses.filter(tx => tx.category === topCategory[0]).length} transaction(s).`,
      impact: `${expenseTotal ? Math.round((topCategory[1] / expenseTotal) * 100) : 0}% of expenses`,
      category: 'Spending',
      priority: 'medium',
      actionText: 'View Transactions',
    });
  }

  budgets.forEach(budget => {
    const spent = Number(budget.spent);
    const limit = Number(budget.amount);
    if (spent > limit) {
      insights.push({
        id: `budget-over-${budget.id}`,
        type: 'alert',
        icon: '⚠️',
        title: `${budget.category} budget exceeded`,
        description: `You have spent ${currency(spent)} against a ${currency(limit)} budget for ${budget.category} this month.`,
        impact: `${currency(spent - limit)} over budget`,
        category: 'Budget',
        priority: 'high',
        actionText: 'Review Budgets',
      });
    } else if (limit > 0 && spent / limit >= 0.8) {
      insights.push({
        id: `budget-near-${budget.id}`,
        type: 'tip',
        icon: '🎯',
        title: `${budget.category} budget nearly used`,
        description: `You have used ${Math.round((spent / limit) * 100)}% of your ${currency(limit)} ${budget.category} budget this month.`,
        impact: `${currency(limit - spent)} remaining`,
        category: 'Budget',
        priority: 'medium',
        actionText: 'Review Budgets',
      });
    }
  });

  if (incomeTotal > 0) {
    const savingsRate = ((incomeTotal - expenseTotal) / incomeTotal) * 100;
    insights.push({
      id: 'monthly-savings-rate',
      type: savingsRate >= 20 ? 'target' : 'tip',
      icon: savingsRate >= 20 ? '🎯' : '💡',
      title: savingsRate >= 20 ? 'Savings are on track' : 'Consider increasing savings',
      description: `This month you have recorded ${currency(incomeTotal)} in income and ${currency(expenseTotal)} in expenses, for a savings rate of ${savingsRate.toFixed(1)}%.`,
      impact: `${currency(incomeTotal - expenseTotal)} net savings`,
      category: 'Savings',
      priority: savingsRate < 0 ? 'high' : 'medium',
      actionText: 'View Analytics',
    });
  }

  if (topCategory && topCategory[1] > 0) {
    const suggestedCut = Math.round(topCategory[1] * 0.1);
    insights.push({
      id: 'category-savings-opportunity',
      type: 'target',
      icon: '💡',
      title: `Savings opportunity in ${topCategory[0]}`,
      description: `A 10% reduction in this month's ${topCategory[0]} spending would keep about ${currency(suggestedCut)} available for savings.`,
      impact: `Potential ${currency(suggestedCut)} this month`,
      category: 'Savings',
      priority: 'low',
      actionText: 'View Transactions',
    });
  }

  if (expenses.length >= 4) {
    const weekendSpend = expenses.reduce((sum, tx) => {
      const day = new Date(`${tx.date}T00:00:00`).getDay();
      return sum + (day === 0 || day === 6 ? Number(tx.amount) : 0);
    }, 0);
    const weekendShare = expenseTotal ? (weekendSpend / expenseTotal) * 100 : 0;
    insights.push({
      id: 'weekend-spending-pattern',
      type: 'trend',
      icon: '📅',
      title: 'Weekend spending pattern',
      description: `${weekendShare.toFixed(0)}% of this month's expenses (${currency(weekendSpend)}) were recorded on Saturdays and Sundays, based on ${expenses.length} transactions.`,
      impact: `${weekendShare.toFixed(0)}% on weekends`,
      category: 'Patterns',
      priority: weekendShare >= 60 ? 'medium' : 'low',
      actionText: 'Review Transactions',
    });
  }

  return insights;
}

const Insights: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'Spending' | 'Budget' | 'Savings' | 'Patterns'>('All');
  const [savingsCut, setSavingsCut] = useState<number>(1500);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const [transactionData, budgetData] = await Promise.all([
          transactionsApi.list({ limit: 2000 }),
          budgetsApi.list({ month: now.getMonth() + 1, year: now.getFullYear() }),
        ]);
        if (active) {
          setTransactions(transactionData);
          setBudgets(budgetData);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load financial insights.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, [refreshKey]);

  const insights = useMemo(() => buildInsights(transactions, budgets, new Date()), [transactions, budgets]);
  const currentMonth = monthKey(new Date());
  const currentTransactions = transactions.filter(tx => tx.date.startsWith(currentMonth));
  const currentIncome = currentTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const currentExpenses = currentTransactions.filter(tx => tx.type === 'expense');
  const currentExpenseTotal = currentExpenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const savingsRate = currentIncome ? ((currentIncome - currentExpenseTotal) / currentIncome) * 100 : 0;
  const budgetLimit = budgets.reduce((sum, budget) => sum + Number(budget.amount), 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent), 0);
  const budgetUsage = budgetLimit ? budgetSpent / budgetLimit : 0;
  const healthScore = currentIncome
    ? Math.max(0, Math.min(100, Math.round(((savingsRate + 20) / 70) * 100) - (budgetUsage > 1 ? 15 : 0)))
    : null;
  const fitnessLabel = healthScore === null ? 'Not enough data' : healthScore >= 70 ? 'Strong' : healthScore >= 45 ? 'Building' : 'Needs attention';
  const currentCategoryTotals = currentExpenses.reduce<Map<string, number>>((totals, tx) => {
    totals.set(tx.category, (totals.get(tx.category) || 0) + Number(tx.amount));
    return totals;
  }, new Map());
  const topCategoryEntry = [...currentCategoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] } : null;
  const effectiveMonthlyCut = Math.min(savingsCut, topCategory?.amount || 0);
  const projectedExtraSavingsRate = currentIncome
    ? ((effectiveMonthlyCut / currentIncome) * 100).toFixed(1)
    : '0.0';
  const filteredInsights = insights
    .filter(i => !dismissed.includes(i.id))
    .filter(i => filter === 'All' || i.category === filter);

  const annualPotentialSavings = effectiveMonthlyCut * 12;

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <h1 className="page-title">💡 Intelligence & Recommendations</h1>
            <p className="page-subtitle">Algorithmic diagnostics, heuristic spending evaluations, and automated savings advice</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(value => value + 1)}
              disabled={loading}
              className="badge-info text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {loading ? 'Updating insights…' : 'Refresh insights'}
            </button>
            <span className="badge-success text-xs px-3 py-1.5">
              Based on your transactions
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium">
            ⚠️ Could not load your financial data: {error}
          </div>
        )}

        {/* Intelligence Score Banner */}
        <div className="section-card mb-8 bg-gradient-to-br from-surface-900 via-surface-900/95 to-primary-950/40 border-primary-500/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary-400"
                    strokeDasharray={`${healthScore ?? 0}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-white">{loading ? '…' : healthScore ?? '—'}</span>
                  <span className="text-[10px] block text-surface-400 font-semibold uppercase">Health</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Financial Fitness: {loading ? 'Loading' : fitnessLabel}</h2>
                  <span className="badge-info text-xs">Based on monthly data</span>
                </div>
                <p className="text-surface-300 text-sm mt-1 max-w-xl">
                  {loading
                    ? 'Calculating your current-month income, expenses, and budget usage.'
                    : currentIncome > 0
                    ? `Your current-month savings rate is ${savingsRate.toFixed(1)}%. ${budgetLimit > 0 ? `You have used ${Math.round(budgetUsage * 100)}% of your current-month budgets.` : 'Add a budget to include budget adherence in your insights.'}`
                    : 'Add income and expense transactions for this month to calculate your financial fitness score.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap lg:flex-col gap-3">
            
            </div>
          </div>
        </div>

        {/* Interactive Savings Simulator */}
        <div className="section-card mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="section-title mb-1">
                <span>🎛️</span> Discretionary Spending Reduction Simulator
              </h2>
              <p className="text-surface-400 text-sm">
                Model how pruning discretionary expenses immediately boosts your annual compounding wealth
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-surface-400 uppercase font-semibold">Monthly Cut</span>
              <p className="text-2xl font-black text-primary-300">{currency(effectiveMonthlyCut)}</p>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max={Math.max(250, Math.min(10000, Math.ceil((topCategory?.amount || 0) / 250) * 250))}
            step="250"
            value={savingsCut}
            onChange={(e) => setSavingsCut(Number(e.target.value))}
            disabled={!topCategory}
            className="w-full h-2 bg-surface-800 rounded-lg appearance-none cursor-pointer accent-primary-500 mb-6"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/50">
              <p className="text-xs text-surface-400 font-semibold uppercase">12-Month Savings Potential</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">+{currency(annualPotentialSavings)}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/50">
              <p className="text-xs text-surface-400 font-semibold uppercase">Savings Rate Surge</p>
              <p className="text-xl font-bold text-primary-300 mt-1">+{projectedExtraSavingsRate}% boost</p>
            </div>
            <div className="p-4 rounded-xl bg-surface-800/50 border border-surface-700/50">
              <p className="text-xs text-surface-400 font-semibold uppercase">Target Primary Channel</p>
              <p className="text-xl font-bold text-amber-300 mt-1">{topCategory?.name || 'No expense data'}</p>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {(['All', 'Spending', 'Budget', 'Savings', 'Patterns'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === tab
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/50'
              }`}
            >
              {tab} {tab === 'All' ? `(${insights.filter(i => !dismissed.includes(i.id)).length})` : ''}
            </button>
          ))}
        </div>

        {/* Generated Insights Cards Grid */}
        {loading ? (
          <div className="section-card text-center text-surface-400">Analyzing your transactions and budgets…</div>
        ) : filteredInsights.length === 0 ? (
          <div className="section-card text-center">
            <h3 className="font-bold text-white mb-2">{insights.length === 0 ? 'No insights yet' : 'No insights in this category'}</h3>
            <p className="text-sm text-surface-400">
              {insights.length === 0
                ? 'Add transactions (and budgets, if useful) to see recommendations based on your financial activity.'
                : 'Try another filter, or refresh after adding more financial activity.'}
            </p>
            {insights.length === 0 && (
              <Link to="/transactions" className="btn-secondary inline-block mt-4">Add a transaction</Link>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredInsights.map((insight) => (
            <div
              key={insight.id}
              className={`section-card relative transition-all duration-300 flex flex-col justify-between ${
                insight.type === 'alert'
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : insight.type === 'target'
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : 'hover:border-surface-600/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/60">
                      {insight.icon}
                    </span>
                    <div>
                      <h3 className="font-bold text-white text-base">{insight.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-surface-400">{insight.category}</span>
                        <span className="text-xs text-surface-600">•</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          insight.priority === 'high' ? 'bg-rose-500/20 text-rose-300' : 'bg-surface-700 text-surface-300'
                        }`}>
                          {insight.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDismissed(prev => [...prev, insight.id])}
                    className="text-surface-500 hover:text-surface-300 text-sm"
                    title="Dismiss insight"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-surface-300 text-sm leading-relaxed mb-4">
                  {insight.description}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-700/40 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-primary-300">
                  {insight.impact}
                </span>
                {insight.actionText && (
                  <Link
                    to={insight.actionText === 'Review Budgets' ? '/budgets' : insight.actionText === 'View Analytics' ? '/analytics' : '/transactions'}
                    className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
                  >
                    {insight.actionText} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default Insights;
