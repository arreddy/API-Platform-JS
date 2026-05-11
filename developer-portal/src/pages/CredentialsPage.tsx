import { useEffect, useState } from 'react';
import { credentialsApi, proxiesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';

interface Credential {
  id: string; name: string; description?: string; key_prefix: string;
  scopes: string[]; expires_at?: string; is_active: boolean;
  last_used_at?: string; created_at: string;
}
interface Proxy { id: string; name: string; }

export default function CredentialsPage() {
  const [creds, setCreds]     = useState<Credential[]>([]);
  const [total, setTotal]     = useState(0);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [newKey, setNewKey]   = useState('');
  const [error, setError]     = useState('');

  const [form, setForm] = useState({
    name: '', description: '',
    proxyIds: [] as string[],
    scopes: ['read'],
    expiresAt: '',
  });

  function load() {
    setLoading(true);
    credentialsApi.list({ limit: 50 })
      .then((r) => { setCreds(r.data.credentials); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    proxiesApi.list({ limit: 100, status: 'active' })
      .then((r) => setProxies(r.data.proxies ?? []))
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setNewKey('');
    try {
      const res = await credentialsApi.create({
        ...form,
        expiresAt: form.expiresAt || undefined,
      });
      setNewKey(res.data.apiKey);
      setShowForm(false);
      setForm({ name: '', description: '', proxyIds: [], scopes: ['read'], expiresAt: '' });
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to create key');
    } finally { setSaving(false); }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This is permanent.`)) return;
    await credentialsApi.revoke(id).catch(console.error);
    load();
  }

  function toggleScope(scope: string) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  }

  return (
    <div>
      <PageHeader title="API Keys" subtitle={`${total} credential${total !== 1 ? 's' : ''}`}
        action={<button className="btn-primary" onClick={() => { setShowForm(true); setNewKey(''); }}>+ Generate Key</button>} />

      <div className="p-8 space-y-6">
        {/* New key display */}
        {newKey && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-5">
            <p className="font-semibold text-green-800">API key generated — copy it now, it won't be shown again.</p>
            <code className="mt-3 block rounded bg-white px-4 py-3 text-sm font-mono text-gray-900 border border-green-200 break-all select-all">
              {newKey}
            </code>
            <button onClick={() => navigator.clipboard.writeText(newKey)}
              className="btn-secondary mt-3 text-xs">Copy to Clipboard</button>
          </div>
        )}

        {showForm && (
          <div className="card p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Generate New API Key</h2>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Key Name *</label>
                  <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    required placeholder="production-key" className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Expires At (optional)</label>
                  <input type="datetime-local" value={form.expiresAt}
                    onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional" className="input" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">Scopes</label>
                <div className="flex gap-3">
                  {['read', 'write', 'delete', 'admin'].map(scope => (
                    <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggleScope(scope)}
                        className="rounded border-gray-300 text-brand-600" />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              {proxies.length > 0 && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-700">
                    Restrict to Proxies (leave empty for all)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                    {proxies.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox"
                          checked={form.proxyIds.includes(p.id)}
                          onChange={() => setForm(f => ({
                            ...f,
                            proxyIds: f.proxyIds.includes(p.id)
                              ? f.proxyIds.filter(x => x !== p.id)
                              : [...f.proxyIds, p.id],
                          }))}
                          className="rounded border-gray-300 text-brand-600" />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Generating…' : 'Generate Key'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          <div className="card overflow-hidden">
            {creds.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                No API keys yet.
                <div className="mt-3"><button className="btn-primary" onClick={() => setShowForm(true)}>Generate first key</button></div>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Prefix</th>
                    <th className="px-6 py-3 text-left">Scopes</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Last Used</th>
                    <th className="px-6 py-3 text-left">Expires</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                  {creds.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {c.name}
                        {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">{c.key_prefix}…</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(typeof c.scopes === 'string' ? JSON.parse(c.scopes) : c.scopes ?? []).map((s: string) => (
                            <span key={s} className="badge bg-blue-50 text-blue-700">{s}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${c.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleRevoke(c.id, c.name)}
                          className="text-xs font-medium text-red-500 hover:text-red-700">Revoke</button>
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
