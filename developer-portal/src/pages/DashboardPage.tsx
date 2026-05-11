import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { apisApi, proxiesApi, credentialsApi, analyticsApi } from '../services/api';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';

interface Summary {
  total_requests: string;
  successful_requests: string;
  avg_response_time: string;
  unique_clients: string;
}

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);
  const [apis, setApis]           = useState(0);
  const [proxies, setProxies]     = useState(0);
  const [keys, setKeys]           = useState(0);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      apisApi.list({ limit: 1 }),
      proxiesApi.list({ limit: 1 }),
      credentialsApi.list({ limit: 1 }),
      analyticsApi.usage(),
      analyticsApi.auditLogs({ limit: 5 }),
    ])
      .then(([a, p, k, usage, audit]) => {
        setApis(a.data.total ?? 0);
        setProxies(p.data.total ?? 0);
        setKeys(k.data.total ?? 0);
        setSummary(usage.data.summary);
        setAuditLogs(audit.data.logs ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.username ? `, ${user.username}` : ''}!`}
        subtitle="Here's an overview of your API platform."
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <StatCard title="Total APIs"       value={apis}    color="blue"   />
          <StatCard title="Active Proxies"   value={proxies} color="green"  />
          <StatCard title="API Keys"         value={keys}    color="purple" />
          <StatCard
            title="Requests (7d)"
            value={summary ? parseInt(summary.total_requests).toLocaleString() : '—'}
            sub={summary ? `Avg ${summary.avg_response_time} ms` : undefined}
            color="orange"
          />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { to: '/apis',         label: 'Register an API',    desc: 'Upload your OpenAPI spec' },
            { to: '/proxies',      label: 'Create a Proxy',     desc: 'Route traffic to a backend' },
            { to: '/credentials',  label: 'Generate API Key',   desc: 'Issue credentials to consumers' },
          ].map((item) => (
            <Link key={item.to} to={item.to}
              className="card p-5 hover:border-brand-300 hover:shadow transition-all">
              <p className="font-semibold text-gray-900">{item.label}</p>
              <p className="mt-1 text-sm text-gray-500">{item.desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent audit activity */}
        <div className="card">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          {auditLogs.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(auditLogs as Array<{ action: string; resource_type: string; description?: string; created_at: string; user_email?: string }>).map((log, i) => (
                <li key={i} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-brand-600">{log.action}</span>
                    {log.description && <p className="text-sm text-gray-600">{log.description}</p>}
                    <p className="text-xs text-gray-400">{log.user_email}</p>
                  </div>
                  <time className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
