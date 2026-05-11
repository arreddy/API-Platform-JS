import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { proxiesApi, apisApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';

interface Proxy {
  id: string; name: string; status: string; api_name?: string;
  target_base_url: string; rate_limit_requests: number;
  rate_limit_window: number; auth_type: string; deployed_at?: string;
}
interface Api { id: string; name: string; }

const STATUS = { active: 'bg-green-100 text-green-800', inactive: 'bg-gray-100 text-gray-600', deleted: 'bg-red-100 text-red-700' };

export default function ProxiesPage() {
  const [searchParams] = useSearchParams();
  const prefillApiId   = searchParams.get('apiId') ?? '';

  const [proxies, setProxies]   = useState<Proxy[]>([]);
  const [apis, setApis]         = useState<Api[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(!!prefillApiId);
  const [saving, setSaving]     = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [error, setError]       = useState('');

  const [form, setForm] = useState({
    name: '', description: '', apiId: prefillApiId,
    targetBaseUrl: '', pathPrefix: '/', authType: 'api_key',
    rateLimitRequests: 1000, rateLimitWindow: 60, timeoutMs: 30000,
    validateRequest: true, validateResponse: false, stripBasePath: true,
  });

  function load() {
    setLoading(true);
    proxiesApi.list({ limit: 20 })
      .then((r) => { setProxies(r.data.proxies); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    apisApi.list({ limit: 100 }).then((r) => setApis(r.data.apis ?? [])).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await proxiesApi.create(form);
      setShowForm(false);
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create proxy');
    } finally { setSaving(false); }
  }

  async function handleDeploy(id: string) {
    setDeploying(id);
    try {
      await proxiesApi.deploy(id);
      load();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Deploy failed');
    } finally { setDeploying(null); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete proxy "${name}"?`)) return;
    await proxiesApi.delete(id).catch(console.error);
    load();
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {node}
    </div>
  );

  return (
    <div>
      <PageHeader title="Proxies" subtitle={`${total} proxy configuration${total !== 1 ? 's' : ''}`}
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ Create Proxy</button>} />

      <div className="p-8 space-y-6">
        {showForm && (
          <div className="card p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Create Proxy</h2>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {field('Proxy Name *', <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required className="input" placeholder="my-api-proxy" />)}
                {field('Target API *', (
                  <select value={form.apiId} onChange={(e) => setForm(f => ({ ...f, apiId: e.target.value }))} required className="input">
                    <option value="">Select API…</option>
                    {apis.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ))}
                {field('Target Base URL *', <input value={form.targetBaseUrl} onChange={(e) => setForm(f => ({ ...f, targetBaseUrl: e.target.value }))} required className="input" placeholder="https://api.example.com" />)}
                {field('Auth Type', (
                  <select value={form.authType} onChange={(e) => setForm(f => ({ ...f, authType: e.target.value }))} className="input">
                    <option value="none">None</option>
                    <option value="api_key">API Key</option>
                    <option value="oauth2">OAuth2</option>
                    <option value="jwt">JWT</option>
                  </select>
                ))}
                {field('Rate Limit (req)', <input type="number" value={form.rateLimitRequests} onChange={(e) => setForm(f => ({ ...f, rateLimitRequests: +e.target.value }))} className="input" />)}
                {field('Window (seconds)', <input type="number" value={form.rateLimitWindow} onChange={(e) => setForm(f => ({ ...f, rateLimitWindow: +e.target.value }))} className="input" />)}
                {field('Timeout (ms)', <input type="number" value={form.timeoutMs} onChange={(e) => setForm(f => ({ ...f, timeoutMs: +e.target.value }))} className="input" />)}
                {field('Path Prefix', <input value={form.pathPrefix} onChange={(e) => setForm(f => ({ ...f, pathPrefix: e.target.value }))} className="input" />)}
              </div>
              {field('Description', <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Optional" />)}
              <div className="flex gap-6 text-sm text-gray-700">
                {[['validateRequest', 'Validate Requests'], ['stripBasePath', 'Strip Base Path']] .map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form[k as keyof typeof form] as boolean}
                      onChange={(e) => setForm(f => ({ ...f, [k]: e.target.checked }))}
                      className="rounded border-gray-300 text-brand-600" />
                    {l}
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Proxy'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          <div className="card overflow-hidden">
            {proxies.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                No proxies yet.
                <div className="mt-3"><button className="btn-primary" onClick={() => setShowForm(true)}>Create your first proxy</button></div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">API</th>
                    <th className="px-6 py-3 text-left">Target</th>
                    <th className="px-6 py-3 text-left">Auth</th>
                    <th className="px-6 py-3 text-left">Rate Limit</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                  {proxies.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-gray-500">{p.api_name ?? '—'}</td>
                      <td className="px-6 py-4 text-gray-500 truncate max-w-[180px]">{p.target_base_url}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{p.auth_type.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-gray-600">{p.rate_limit_requests}/{p.rate_limit_window}s</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${STATUS[p.status as keyof typeof STATUS] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        {p.status !== 'active' && (
                          <button onClick={() => handleDeploy(p.id)} disabled={deploying === p.id}
                            className="text-xs font-medium text-brand-600 hover:text-brand-800">
                            {deploying === p.id ? 'Deploying…' : 'Deploy'}
                          </button>
                        )}
                        <button onClick={() => handleDelete(p.id, p.name)}
                          className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                      </td>
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
