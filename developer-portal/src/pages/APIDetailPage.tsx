import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { apisApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

type Tab = 'overview' | 'docs' | 'proxies' | 'versions';

interface ApiDetail {
  id: string;
  name: string;
  version: string;
  status: string;
  visibility: string;
  description?: string;
  total_endpoints: number;
  oas_spec: unknown;
  proxy_count: number;
  version_count: number;
  created_at: string;
}

export default function APIDetailPage() {
  const { apiId } = useParams<{ apiId: string }>();
  const [api, setApi]         = useState<ApiDetail | null>(null);
  const [proxies, setProxies] = useState<unknown[]>([]);
  const [versions, setVersions] = useState<unknown[]>([]);
  const [tab, setTab]         = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiId) return;
    Promise.all([
      apisApi.get(apiId),
      apisApi.versions(apiId),
    ])
      .then(([apiRes, vRes]) => {
        setApi(apiRes.data.api);
        setVersions(vRes.data.versions ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [apiId]);

  if (loading) return <LoadingSpinner />;
  if (!api)    return <div className="p-8 text-red-500">API not found.</div>;

  const oasSpec = typeof api.oas_spec === 'string' ? JSON.parse(api.oas_spec) : api.oas_spec;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'docs',      label: 'API Docs' },
    { id: 'proxies',   label: `Proxies (${api.proxy_count})` },
    { id: 'versions',  label: `Versions (${api.version_count})` },
  ];

  return (
    <div>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="mb-1 text-sm text-gray-400">
          <Link to="/apis" className="hover:text-brand-600">APIs</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900">{api.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{api.name}</h1>
            {api.description && <p className="mt-1 text-sm text-gray-500">{api.description}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className={`badge ${api.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {api.status}
            </span>
            <Link to={`/proxies?apiId=${api.id}`} className="btn-primary text-xs">
              + Create Proxy
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-6 flex gap-1 border-b -mb-6 pt-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              { label: 'Version',   value: api.version },
              { label: 'Endpoints', value: api.total_endpoints },
              { label: 'Visibility',value: api.visibility },
              { label: 'Created',   value: new Date(api.created_at).toLocaleDateString() },
            ].map((item) => (
              <div key={item.label} className="card p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'docs' && oasSpec && (
          <div className="card overflow-hidden">
            <SwaggerUI spec={oasSpec} />
          </div>
        )}

        {tab === 'proxies' && (
          <div className="card overflow-hidden">
            {(proxies as Array<{ id: string; name: string; status: string; target_base_url: string }>).length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No proxies created for this API yet.
                <div className="mt-3">
                  <Link to={`/proxies?apiId=${api.id}`} className="btn-primary text-xs">Create Proxy</Link>
                </div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Target</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(proxies as Array<{ id: string; name: string; status: string; target_base_url: string }>).map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-3">{p.name}</td>
                      <td className="px-6 py-3 text-gray-500">{p.target_base_url}</td>
                      <td className="px-6 py-3">
                        <span className={`badge ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'versions' && (
          <div className="card overflow-hidden">
            {versions.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">No version history.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Version</th>
                    <th className="px-6 py-3 text-left">Breaking Changes</th>
                    <th className="px-6 py-3 text-left">Changelog</th>
                    <th className="px-6 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(versions as Array<{ id: string; version_number: string; breaking_changes: boolean; changelog?: string; created_at: string }>).map((v) => (
                    <tr key={v.id}>
                      <td className="px-6 py-3 font-medium">{v.version_number}</td>
                      <td className="px-6 py-3">
                        {v.breaking_changes
                          ? <span className="badge bg-red-100 text-red-700">Yes</span>
                          : <span className="badge bg-gray-100 text-gray-600">No</span>}
                      </td>
                      <td className="px-6 py-3 text-gray-500">{v.changelog ?? '—'}</td>
                      <td className="px-6 py-3 text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
