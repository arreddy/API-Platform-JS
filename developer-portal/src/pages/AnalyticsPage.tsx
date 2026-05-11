import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsApi, proxiesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';

interface TimeSeries {
  period: string;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time: number;
}

interface PerfRow {
  proxy_id: string; method: string; avg_response_time: number;
  p50: number; p95: number; p99: number; request_count: number;
}

interface ErrRow { status_code: number; method: string; count: number; percentage: number; }
interface Summary { total_requests: string; successful_requests: string; failed_requests: string; avg_response_time: string; unique_clients: string; }

export default function AnalyticsPage() {
  const [range, setRange]         = useState('7d');
  const [proxyId, setProxyId]     = useState('');
  const [proxies, setProxies]     = useState<{ id: string; name: string }[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeries[]>([]);
  const [perf, setPerf]           = useState<PerfRow[]>([]);
  const [errors, setErrors]       = useState<ErrRow[]>([]);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);

  function dateRange() {
    const end   = new Date();
    const start = new Date();
    if (range === '24h') start.setHours(start.getHours() - 24);
    if (range === '7d')  start.setDate(start.getDate() - 7);
    if (range === '30d') start.setDate(start.getDate() - 30);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  function load() {
    setLoading(true);
    const params = { ...dateRange(), ...(proxyId ? { proxyId } : {}), interval: range === '24h' ? 'hour' : 'day' };
    Promise.all([
      analyticsApi.usage(params),
      analyticsApi.performance(params),
      analyticsApi.errors(params),
    ])
      .then(([u, p, e]) => {
        setTimeSeries(u.data.timeSeries ?? []);
        setSummary(u.data.summary);
        setPerf(p.data.performance ?? []);
        setErrors(e.data.errors ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    proxiesApi.list({ limit: 100 }).then(r => setProxies(r.data.proxies ?? [])).catch(console.error);
  }, []);

  useEffect(load, [range, proxyId]);

  const fmt = (v: string | number) => parseInt(String(v)).toLocaleString();
  const chartData = timeSeries.map(d => ({
    ...d,
    period: new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    total_requests:      Number(d.total_requests),
    successful_requests: Number(d.successful_requests),
    failed_requests:     Number(d.failed_requests),
    avg_response_time:   Number(d.avg_response_time),
  }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Request traffic, latency, and error metrics." />

      <div className="p-8 space-y-8">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-gray-200 p-1 bg-white">
            {['24h', '7d', '30d'].map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${range === r ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {r}
              </button>
            ))}
          </div>
          <select value={proxyId} onChange={e => setProxyId(e.target.value)}
            className="input w-52">
            <option value="">All Proxies</option>
            {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
            {/* Summary stats */}
            {summary && (
              <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                <StatCard title="Total Requests"    value={fmt(summary.total_requests)}    color="blue"   />
                <StatCard title="Successful"        value={fmt(summary.successful_requests)} color="green"  />
                <StatCard title="Failed"            value={fmt(summary.failed_requests)}   color="orange" />
                <StatCard title="Avg Latency (ms)"  value={summary.avg_response_time ?? '—'} color="purple" />
              </div>
            )}

            {/* Request volume chart */}
            <div className="card p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Request Volume</h2>
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No data for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="success" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="failed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="successful_requests" name="Successful" stroke="#22c55e" fill="url(#success)" />
                    <Area type="monotone" dataKey="failed_requests"     name="Failed"     stroke="#ef4444" fill="url(#failed)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Latency chart */}
            {chartData.length > 0 && (
              <div className="card p-6">
                <h2 className="mb-4 font-semibold text-gray-900">Avg Response Time (ms)</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avg_response_time" name="Avg ms" stroke="#6366f1" fill="#eef2ff" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              {/* Errors by status */}
              <div className="card p-6">
                <h2 className="mb-4 font-semibold text-gray-900">Errors by Status Code</h2>
                {errors.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No errors in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={errors.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="status_code" type="category" tick={{ fontSize: 11 }} width={40} />
                      <Tooltip />
                      <Bar dataKey="count" name="Count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Latency percentiles */}
              <div className="card p-6">
                <h2 className="mb-4 font-semibold text-gray-900">Latency Percentiles (ms)</h2>
                {perf.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No data.</p>
                ) : (
                  <div className="overflow-y-auto max-h-52">
                    <table className="min-w-full text-sm">
                      <thead className="text-xs text-gray-500">
                        <tr>
                          <th className="py-2 text-left">Method</th>
                          <th className="py-2 text-right">P50</th>
                          <th className="py-2 text-right">P95</th>
                          <th className="py-2 text-right">P99</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {perf.map((r, i) => (
                          <tr key={i}>
                            <td className="py-2 font-mono text-xs">{r.method}</td>
                            <td className="py-2 text-right text-gray-600">{r.p50}</td>
                            <td className="py-2 text-right text-gray-600">{r.p95}</td>
                            <td className="py-2 text-right text-gray-600">{r.p99}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
