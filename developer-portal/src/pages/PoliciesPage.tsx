import { useEffect, useState } from 'react';
import { policiesApi, proxiesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';

interface Policy {
  id: string; name: string; type: string; is_active: boolean;
  priority: number; proxy_id?: string; description?: string; created_at: string;
}
interface Proxy { id: string; name: string; }

const TYPE_COLORS: Record<string, string> = {
  rate_limit: 'bg-orange-100 text-orange-800',
  auth:       'bg-blue-100 text-blue-800',
  transform:  'bg-purple-100 text-purple-800',
  cors:       'bg-cyan-100 text-cyan-800',
  ip_filter:  'bg-red-100 text-red-800',
  header:     'bg-gray-100 text-gray-700',
};

const POLICY_CONFIGS: Record<string, { label: string; fields: { key: string; label: string; type: string; placeholder?: string }[] }> = {
  rate_limit: {
    label: 'Rate Limit',
    fields: [
      { key: 'maxRequests', label: 'Max Requests', type: 'number', placeholder: '1000' },
      { key: 'windowSeconds', label: 'Window (seconds)', type: 'number', placeholder: '60' },
    ],
  },
  auth: {
    label: 'Authentication',
    fields: [
      { key: 'type', label: 'Auth Type', type: 'text', placeholder: 'api_key' },
      { key: 'header', label: 'Header Name', type: 'text', placeholder: 'X-API-Key' },
    ],
  },
  cors: {
    label: 'CORS',
    fields: [
      { key: 'origins', label: 'Allowed Origins (comma-sep)', type: 'text', placeholder: 'https://app.example.com' },
      { key: 'methods', label: 'Allowed Methods', type: 'text', placeholder: 'GET,POST,PUT' },
    ],
  },
  header: {
    label: 'Header',
    fields: [
      { key: 'name', label: 'Header Name', type: 'text', placeholder: 'X-Custom-Header' },
      { key: 'value', label: 'Header Value', type: 'text', placeholder: 'my-value' },
    ],
  },
  ip_filter: {
    label: 'IP Filter',
    fields: [
      { key: 'allowList', label: 'Allow List (comma-sep)', type: 'text', placeholder: '10.0.0.0/8,192.168.1.0/24' },
    ],
  },
  transform: {
    label: 'Transform',
    fields: [
      { key: 'target', label: 'Target', type: 'text', placeholder: 'request|response' },
      { key: 'rule', label: 'Rule (JSON)', type: 'text', placeholder: '{}' },
    ],
  },
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [total, setTotal]       = useState(0);
  const [proxies, setProxies]   = useState<Proxy[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [configFields, setConfigFields] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '', description: '', type: 'rate_limit', proxyId: '', priority: 0, isActive: true,
  });

  function load() {
    setLoading(true);
    policiesApi.list({ limit: 50 })
      .then(r => { setPolicies(r.data.policies); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    proxiesApi.list({ limit: 100 }).then(r => setProxies(r.data.proxies ?? [])).catch(console.error);
  }, []);

  function buildConfig(): Record<string, unknown> {
    const cfg: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(configFields)) {
      cfg[k] = v;
    }
    return cfg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await policiesApi.create({ ...form, config: buildConfig(), proxyId: form.proxyId || undefined });
      setShowForm(false);
      setForm({ name: '', description: '', type: 'rate_limit', proxyId: '', priority: 0, isActive: true });
      setConfigFields({});
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create policy');
    } finally { setSaving(false); }
  }

  async function handleToggle(id: string, current: boolean) {
    await policiesApi.update(id, { isActive: !current }).catch(console.error);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete policy "${name}"?`)) return;
    await policiesApi.delete(id).catch(console.error);
    load();
  }

  const currentMeta = POLICY_CONFIGS[form.type];

  return (
    <div>
      <PageHeader title="Policies" subtitle={`${total} polic${total !== 1 ? 'ies' : 'y'}`}
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Policy</button>} />

      <div className="p-8 space-y-6">
        {showForm && (
          <div className="card p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Create Policy</h2>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Policy Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required className="input" placeholder="my-rate-limit" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Type *</label>
                  <select value={form.type} onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setConfigFields({}); }}
                    className="input">
                    {Object.entries(POLICY_CONFIGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Apply to Proxy</label>
                  <select value={form.proxyId} onChange={e => setForm(f => ({ ...f, proxyId: e.target.value }))} className="input">
                    <option value="">All Proxies</option>
                    {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Priority (higher = first)</label>
                  <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))}
                    className="input" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="input" placeholder="Optional" />
              </div>

              {/* Dynamic config fields */}
              {currentMeta && (
                <div>
                  <p className="mb-2 text-xs font-medium text-gray-700 uppercase tracking-wide">
                    {currentMeta.label} Configuration
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {currentMeta.fields.map(f => (
                      <div key={f.key}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                        <input type={f.type} value={configFields[f.key] ?? ''} placeholder={f.placeholder}
                          onChange={e => setConfigFields(c => ({ ...c, [f.key]: e.target.value }))}
                          className="input" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create Policy'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          <div className="card overflow-hidden">
            {policies.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                No policies yet.
                <div className="mt-3"><button className="btn-primary" onClick={() => setShowForm(true)}>Add first policy</button></div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Type</th>
                    <th className="px-6 py-3 text-left">Priority</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Created</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                  {policies.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {p.name}
                        {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${TYPE_COLORS[p.type] ?? 'bg-gray-100 text-gray-600'}`}>{p.type.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{p.priority}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleToggle(p.id, p.is_active)}
                          className={`badge cursor-pointer ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
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
