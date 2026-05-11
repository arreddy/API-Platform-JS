import { NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/slices/authSlice';

const nav = [
  { to: '/dashboard',   label: 'Dashboard',    icon: '⊞' },
  { to: '/apis',        label: 'APIs',          icon: '◈' },
  { to: '/proxies',     label: 'Proxies',       icon: '⇄' },
  { to: '/policies',    label: 'Policies',      icon: '⚙' },
  { to: '/credentials', label: 'API Keys',      icon: '🔑' },
  { to: '/analytics',   label: 'Analytics',     icon: '📊' },
];

export default function Sidebar() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const user       = useAppSelector((s) => s.auth.user);

  function handleLogout() {
    dispatch(logout());
    navigate('/login');
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <span className="text-lg font-bold text-brand-700">API Platform</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 p-4">
        <div className="mb-2 truncate text-xs text-gray-500">{user?.email}</div>
        <button onClick={handleLogout} className="btn-secondary w-full justify-center text-xs">
          Sign out
        </button>
      </div>
    </aside>
  );
}
