import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './store/hooks';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import APIsPage from './pages/APIsPage';
import APIDetailPage from './pages/APIDetailPage';
import ProxiesPage from './pages/ProxiesPage';
import PoliciesPage from './pages/PoliciesPage';
import CredentialsPage from './pages/CredentialsPage';
import AnalyticsPage from './pages/AnalyticsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAppSelector((s) => s.auth.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="apis"         element={<APIsPage />} />
        <Route path="apis/:apiId"  element={<APIDetailPage />} />
        <Route path="proxies"      element={<ProxiesPage />} />
        <Route path="policies"     element={<PoliciesPage />} />
        <Route path="credentials"  element={<CredentialsPage />} />
        <Route path="analytics"    element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
