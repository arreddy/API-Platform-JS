import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';
import { authApi } from '../services/api';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const [mode, setMode]       = useState<Mode>('login');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', username: '', firstName: '', lastName: '', organizationName: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await authApi.login(form.email, form.password);
        dispatch(setCredentials({
          token:        res.data.token,
          refreshToken: res.data.refreshToken,
          user:         res.data.user,
        }));
        navigate('/dashboard');
      } else {
        const res = await authApi.register(form);
        dispatch(setCredentials({
          token:        res.data.token,
          refreshToken: res.data.refreshToken,
          user:         res.data.user,
        }));
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">API Platform</h1>
          <p className="mt-2 text-brand-100">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* Tab toggle */}
          <div className="mb-6 flex rounded-lg border border-gray-200 p-1">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-brand-600 text-white shadow' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">First Name</label>
                    <input name="firstName" value={form.firstName} onChange={handleChange}
                      placeholder="Jane" className="input" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">Last Name</label>
                    <input name="lastName" value={form.lastName} onChange={handleChange}
                      placeholder="Doe" className="input" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Username *</label>
                  <input name="username" value={form.username} onChange={handleChange}
                    required placeholder="janedoe" className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Organization Name</label>
                  <input name="organizationName" value={form.organizationName} onChange={handleChange}
                    placeholder="Acme Corp" className="input" />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Email *</label>
              <input name="email" type="email" value={form.email} onChange={handleChange}
                required placeholder="jane@example.com" className="input" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Password *</label>
              <input name="password" type="password" value={form.password} onChange={handleChange}
                required placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'} className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
