import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apisApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';

interface Api {
  id: string;
  name: string;
  version: string;
  status: string;
  visibility: string;
  total_endpoints: number;
  description?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-yellow-100 text-yellow-800',
  active:    'bg-green-100 text-green-800',
  deprecated:'bg-red-100 text-red-800',
};

export default function APIsPage() {
  const [apis, setApis]       = useState<Api[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const fileRef               = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '', description: '', visibility: 'private', oasSpec: null as unknown,
  });

  function loadApis() {
    setLoading(true);
    apisApi.list({ limit: 20, offset: 0 })
      .then((res) => { setApis(res.data.apis); setTotal(res.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(loadApis, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const spec = JSON.parse(text);
      setForm((f) => ({ ...f, oasSpec: spec, name: f.name || spec.info?.title || '' }));
      setError('');
    } catch {
      setError('Invalid JSON file. Please upload a valid OpenAPI 3.0 spec.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.oasSpec) { setError('Please upload an OAS spec file.'); return; }
    setSaving(true);
    setError('');
    try {
      await apisApi.create(form);
      setShowForm(false);
      setForm({ name: '', description: '', visibility: 'private', oasSpec: null });
      if (fileRef.current) fileRef.current.value = '';
      loadApis();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to register API');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await apisApi.delete(id).catch(console.error);
    loadApis();
  }

  return (
    <div>
      <PageHeader
        title="APIs"
        subtitle={`${total} registered API${total !== 1 ? 's' : ''}`}
        action={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Register API
          </button>
        }
      />

      <div className="p-8 space-y-6">
        {/* Register form */}
        {showForm && (
          <div className="card p-6">
            <h2 className="mb-4 font-semibold text-gray-900">Register New API</h2>
            {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">OAS File (JSON) *</label>
                <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">API Name *</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required placeholder="My API" className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Visibility</label>
                  <select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                    className="input">
                    <option value="private">Private</option>
                    <option value="internal">Internal</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description" className="input" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Registering…' : 'Register API'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {loading ? <LoadingSpinner /> : (
          <div className="card overflow-hidden">
            {apis.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-400 text-sm">No APIs registered yet.</p>
                <button className="btn-primary mt-4" onClick={() => setShowForm(true)}>Register your first API</button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Version</th>
                    <th className="px-6 py-3 text-left">Endpoints</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Visibility</th>
                    <th className="px-6 py-3 text-left">Created</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {apis.map((api) => (
                    <tr key={api.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link to={`/apis/${api.id}`} className="font-medium text-brand-600 hover:underline">
                          {api.name}
                        </Link>
                        {api.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{api.description}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{api.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{api.total_endpoints}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${STATUS_COLORS[api.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {api.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{api.visibility}</td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {new Date(api.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(api.id, api.name)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium">
                          Delete
                        </button>
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
