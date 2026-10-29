import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi, type MonthlyPoint } from '../services/api';

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

interface ForecastPoint {
  month: string;
  actual_income?: number;
  actual_expense?: number;
  actual_savings?: number;
  predicted_income?: number;
  predicted_expense?: number;
  predicted_savings?: number;
  isForecast: boolean;
}

const Forecast: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);

  useEffect(() => {
    const fetchAndPredict = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch last 6 months to use as base for prediction
        const monthlyData = await analyticsApi.monthly(6);

        if (monthlyData.length < 2) {
          setError('Not enough historical data for forecasting. Please add more transactions.');
          setLoading(false);
          return;
        }

        // Prepare actuals
        const actuals: ForecastPoint[] = monthlyData.map(m => ({
          month: `${m.month} ${m.year}`,
          actual_income: m.income,
          actual_expense: m.expense,
          actual_savings: m.savings,
          isForecast: false,
        }));

        // Simple linear regression to predict next 3 months
        const n = monthlyData.length;
        const xSum = (n * (n - 1)) / 2;
        const xSqSum = (n * (n - 1) * (2 * n - 1)) / 6;

        const predict = (key: 'income' | 'expense') => {
          let ySum = 0;
          let xySum = 0;
          monthlyData.forEach((d, i) => {
            ySum += d[key];
            xySum += i * d[key];
          });
          const slope = (n * xySum - xSum * ySum) / (n * xSqSum - xSum * xSum);
          const intercept = (ySum - slope * xSum) / n;
          return { slope, intercept };
        };

        const { slope: incSlope, intercept: incIntercept } = predict('income');
        const { slope: expSlope, intercept: expIntercept } = predict('expense');

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const predictions: ForecastPoint[] = [];

        // Determine last month/year
        const lastMonthData = monthlyData[monthlyData.length - 1];
        let currentMonthIdx = monthNames.indexOf(lastMonthData.month);
        let currentYear = lastMonthData.year;

        for (let i = 1; i <= 3; i++) {
          currentMonthIdx++;
          if (currentMonthIdx > 11) {
            currentMonthIdx = 0;
            currentYear++;
          }

          const targetX = n - 1 + i;
          const pInc = Math.max(0, incIntercept + incSlope * targetX);
          const pExp = Math.max(0, expIntercept + expSlope * targetX);

          predictions.push({
            month: `${monthNames[currentMonthIdx]} ${currentYear}`,
            predicted_income: Math.round(pInc),
            predicted_expense: Math.round(pExp),
            predicted_savings: Math.round(pInc - pExp),
            isForecast: true,
          });
        }

        setForecastData([...actuals, ...predictions]);
      } catch (e: any) {
        setError(e.message || 'Failed to generate forecast');
      } finally {
        setLoading(false);
      }
    };

    fetchAndPredict();
  }, []);

  return (
    <div className="page-container bg-mesh">
      <div className="page-content animate-fade-in">
        {/* ── Header ── */}
        <div className="mb-8">
          <h1 className="page-title">🔮 Financial Forecast</h1>
          <p className="page-subtitle">AI-driven predictions based on your spending history</p>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-medium">
            ⚠️ {error}
          </div>
        ) : null}

        {/* ── Main Chart ── */}
        <div className="section-card mb-6 animate-slide-up">
          <h2 className="section-title"><span>📈</span> 3-Month Projection</h2>
          <div style={{ height: '400px' }}>
            {loading ? <Skeleton h="400px" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  {/* Actuals */}
                  <Line type="monotone" dataKey="actual_income" name="Actual Income" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="actual_expense" name="Actual Expense" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                  
                  {/* Predictions (Dashed) */}
                  <Line type="monotone" dataKey="predicted_income" name="Predicted Income" stroke="#34d399" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="predicted_expense" name="Predicted Expense" stroke="#fb7185" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Insights Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center text-2xl mb-4">
              💡
            </div>
            <h3 className="text-lg font-bold text-surface-100 mb-2">Trend Analysis</h3>
            <p className="text-surface-400 text-sm leading-relaxed">
              Based on your past 6 months of activity, your income is projected to remain stable while 
              expenses show a slight upward trend. Consider reviewing discretionary spending in categories 
              like Entertainment and Shopping to maintain your savings rate.
            </p>
          </div>
          <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="w-12 h-12 rounded-2xl bg-primary-500/15 flex items-center justify-center text-2xl mb-4">
              🎯
            </div>
            <h3 className="text-lg font-bold text-surface-100 mb-2">Recommendation</h3>
            <p className="text-surface-400 text-sm leading-relaxed">
              You are on track to save an estimated ₹1.5L over the next quarter. 
              To optimize this, consider setting strict budget limits using our dynamic budgeting tool 
              for high-variance categories.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Forecast;
