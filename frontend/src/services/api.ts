// frontend/src/services/api.ts
// Central API service — all HTTP calls go through here with JWT auth

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// ── Generic fetch helper ──────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('finsight_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // If not already on auth page, clear session and notify
    if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
      localStorage.removeItem('finsight_token');
      localStorage.removeItem('finsight_user');
      window.location.href = '/login';
    }
    const err = await res.json().catch(() => ({ detail: 'Session expired. Please log in again.' }));
    throw new Error(err.detail || 'Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id:         number;
  name:       string;
  email:      string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type:   string;
  user:         User;
}

export interface Transaction {
  id:           number;
  user_id:      number | null;
  type:         'income' | 'expense';
  category:     string;
  payment_mode: string;
  description:  string;
  amount:       number;
  date:         string;   // "YYYY-MM-DD"
  source:       'ui' | 'iot' | 'import';
  created_at:   string;
}

export interface TransactionCreate {
  type:         'income' | 'expense';
  category:     string;
  payment_mode: string;
  description:  string;
  amount:       number;
  date:         string;
  source?:      'ui' | 'iot' | 'import';
}

export interface Budget {
  id:       number;
  user_id:  number | null;
  category: string;
  amount:   number;
  spent:    number;
  month:    number;
  year:     number;
}

export interface BudgetCreate {
  category: string;
  amount:   number;
  month:    number;
  year:     number;
}

export interface MonthlyPoint {
  month:      string;
  year:       number;
  income:     number;
  expense:    number;
  savings:    number;
  budgetUsed?: number;
}

export interface CategoryPoint {
  name:  string;
  value: number;
  color: string;
}

export interface PaymentMethodPoint {
  name:       string;
  value:      number;
  percentage: number;
  color:      string;
}

export interface KPIs {
  income:       number;
  expense:      number;
  savings:      number;
  savings_rate: number;
  balance:      number;
  budget_used:  number;
}

export interface AnomalyItem {
  id:             string;
  transaction_id: number;
  category:       string;
  amount:         number;
  typicalMin:     number;
  typicalMax:     number;
  date:           string;
  merchant:       string;
  zScore:         number;
  severity:       'critical' | 'high' | 'moderate';
  status:         'pending' | 'verified' | 'flagged';
  reason:         string;
  algorithm?:     string;
}

export interface AnomalyMetrics {
  total_analyzed:  number;
  expense_count:   number;
  anomalies_count: number;
  pending_count:   number;
  flagged_count:   number;
  verified_count:  number;
  exposure_sum:    number;
  sensitivity:     number;
  algorithm:       string;
  analyzed_at:     string;
}

export interface AnomalyResponse {
  anomalies: AnomalyItem[];
  metrics:   AnomalyMetrics;
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: () => apiFetch<User>('/api/auth/me'),

  updateMe: (data: { name?: string; email?: string; password?: string }) =>
    apiFetch<User>('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ── Budget API ────────────────────────────────────────────────────────────────
export const budgetsApi = {
  list: (params?: { month?: number; year?: number }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year)  qs.set('year', String(params.year));
    return apiFetch<Budget[]>(`/api/budgets/?${qs}`);
  },

  create: (data: BudgetCreate) =>
    apiFetch<Budget>('/api/budgets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<BudgetCreate>) =>
    apiFetch<Budget>(`/api/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<void>(`/api/budgets/${id}`, { method: 'DELETE' }),
};

// ── Transaction API ───────────────────────────────────────────────────────────
export const transactionsApi = {
  list: (params?: {
    type?: string;
    category?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.type)      qs.set('type', params.type);
    if (params?.category)  qs.set('category', params.category);
    if (params?.from_date) qs.set('from_date', params.from_date);
    if (params?.to_date)   qs.set('to_date', params.to_date);
    if (params?.limit)     qs.set('limit', String(params.limit));
    if (params?.offset)    qs.set('offset', String(params.offset));
    return apiFetch<Transaction[]>(`/api/transactions/?${qs}`);
  },

  create: (data: TransactionCreate) =>
    apiFetch<Transaction>('/api/transactions/', {
      method: 'POST',
      body:   JSON.stringify(data),
    }),

  createBatch: (transactions: TransactionCreate[]) =>
    apiFetch<Transaction[]>('/api/transactions/batch', {
      method: 'POST',
      body:   JSON.stringify({ transactions }),
    }),

  update: (id: number, data: Partial<TransactionCreate>) =>
    apiFetch<Transaction>(`/api/transactions/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<void>(`/api/transactions/${id}`, { method: 'DELETE' }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  kpis: (month?: number, year?: number) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', String(month));
    if (year)  qs.set('year', String(year));
    return apiFetch<KPIs>(`/api/analytics/kpis?${qs}`);
  },

  monthly: (months = 6) =>
    apiFetch<MonthlyPoint[]>(`/api/analytics/monthly?months=${months}`),

  categories: (month?: number, year?: number) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', String(month));
    if (year)  qs.set('year', String(year));
    return apiFetch<CategoryPoint[]>(`/api/analytics/categories?${qs}`);
  },

  paymentMethods: (month?: number, year?: number) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', String(month));
    if (year)  qs.set('year', String(year));
    return apiFetch<PaymentMethodPoint[]>(`/api/analytics/payment-methods?${qs}`);
  },

  recent: (limit = 5) =>
    apiFetch<Transaction[]>(`/api/analytics/recent?limit=${limit}`),

  anomalies: (params?: { algorithm?: string; threshold?: number; month?: number; year?: number }) => {
    const qs = new URLSearchParams();
    if (params?.algorithm) qs.set('algorithm', params.algorithm);
    if (params?.threshold !== undefined) qs.set('threshold', String(params.threshold));
    if (params?.month) qs.set('month', String(params.month));
    if (params?.year)  qs.set('year', String(params.year));
    return apiFetch<AnomalyResponse>(`/api/analytics/anomalies?${qs}`);
  },

  updateAnomalyStatus: (txId: number, status: 'verified' | 'flagged') =>
    apiFetch<{ status: string; transaction_id: number; review_status: string }>(
      `/api/analytics/anomalies/${txId}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      }
    ),

  simulateAnomaly: (data?: { category?: string; amount?: number; description?: string }) =>
    apiFetch<{ status: string; transaction: any }>('/api/analytics/simulate-anomaly', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
};
