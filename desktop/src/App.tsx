import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Properties from './pages/Properties';
import PropertyDetails from './pages/PropertyDetails';
import UnitDetails from './pages/UnitDetails';
import TenantDetails from './pages/TenantDetails';
import Units from './pages/Units';
import Tenants from './pages/Tenants';
import RentRecords from './pages/RentRecords';
import UtilityBills from './pages/UtilityBills';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import TopBar from './components/TopBar';
import Transactions from './pages/Transactions';
import Utilities from './pages/Utilities';
import ElectricityReadings from './pages/ElectricityReadings';
import api from './lib/api';
import { appStorage } from './lib/appStorage';
import { connectRealtime } from './lib/realtimeSocket';
import { invalidateAll } from './lib/queryCache';
import PortfolioOnboarding from './components/PortfolioOnboarding';
import ToastViewport from './components/ToastViewport';
import ConfirmDialogHost from './components/ConfirmDialogHost';
import { I18nProvider, useI18n } from './lib/i18n';

type AuthStatus = 'checking' | 'needs-portfolio' | 'authenticated' | 'unauthenticated';
const SESSION_SNAPSHOT_KEY = 'rentdesk_session_snapshot_v1';

const loadSessionSnapshot = () => {
  try {
    const raw = appStorage.getItem(SESSION_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSessionSnapshot = (snapshot: any) => {
  try {
    appStorage.setItem(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage write issues and keep app usable
  }
};

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { t } = useI18n();
  const token = appStorage.getItem('rentdesk_token');
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>(token ? 'checking' : 'unauthenticated');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const verifySession = useCallback(async () => {
    const currentToken = appStorage.getItem('rentdesk_token');
    if (!currentToken) {
      setStatus('unauthenticated');
      setCurrentUser(null);
      appStorage.removeItem('rentdesk_active_portfolio_id');
      return;
    }

    try {
      setStatus('checking');
      const [meRes, portfolioListRes] = await Promise.all([api.get('/auth/me'), api.get('/portfolio/list')]);
      const user = meRes.data?.user || null;
      const portfolios = portfolioListRes.data?.portfolios || [];
      const activePortfolioId = String(portfolioListRes.data?.activePortfolioId || '');
      setCurrentUser(user);

      if (activePortfolioId) {
        appStorage.setItem('rentdesk_active_portfolio_id', activePortfolioId);
      } else {
        appStorage.removeItem('rentdesk_active_portfolio_id');
      }

      saveSessionSnapshot({
        user,
        portfolios,
        activePortfolioId,
        cachedAt: new Date().toISOString()
      });

      if (!portfolios.length) {
        setStatus('needs-portfolio');
        return;
      }

      setStatus('authenticated');
      connectRealtime();
    } catch (error: any) {
      const statusCode = Number(error?.response?.status || 0);
      const isUnauthorized = statusCode === 401;

      if (isUnauthorized) {
        appStorage.removeItem('rentdesk_token');
        appStorage.removeItem('rentdesk_active_portfolio_id');
        setCurrentUser(null);
        setStatus('unauthenticated');
        return;
      }

      const fallbackSnapshot = loadSessionSnapshot();
      if (fallbackSnapshot?.user) {
        setCurrentUser(fallbackSnapshot.user);
        if (fallbackSnapshot.activePortfolioId) {
          appStorage.setItem('rentdesk_active_portfolio_id', String(fallbackSnapshot.activePortfolioId));
        }
        if ((fallbackSnapshot.portfolios || []).length) {
          setStatus('authenticated');
          connectRealtime();
        } else {
          setStatus('needs-portfolio');
        }
        return;
      }

      setCurrentUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('unauthenticated');
      setCurrentUser(null);
      return;
    }

    void verifySession();
  }, [token, verifySession]);

  if (!token || status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'checking') {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[var(--bg)] text-sm text-[var(--muted)]">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white flex items-center justify-center font-semibold shadow-[0_10px_20px_rgba(15,118,110,0.3)] animate-pulse">
          RD
        </div>
        {t('Checking session...')}
      </div>
    );
  }

  if (status === 'needs-portfolio') {
    return <PortfolioOnboarding user={currentUser} onReady={verifySession} />;
  }

  return children;
};

const App = () => {
  return (
    <I18nProvider>
      <div className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <div className="flex h-full">
                  <Sidebar />
                  <main className="flex-1 min-w-0 h-full overflow-hidden px-10 pt-8 pb-6">
                    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden">
                      <div className="shrink-0">
                        <TopBar />
                      </div>
                      <div className="flex-1 overflow-y-auto pr-2">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/properties" element={<Properties />} />
                          <Route path="/properties/:propertyId" element={<PropertyDetails />} />
                          <Route path="/properties/:propertyId/units/:unitId" element={<UnitDetails />} />
                          <Route path="/properties/:propertyId/tenants/:tenantId" element={<TenantDetails />} />
                          <Route path="/units" element={<Units />} />
                          <Route path="/tenants" element={<Tenants />} />
                          <Route path="/rent-records" element={<RentRecords />} />
                          <Route path="/utility-bills" element={<UtilityBills />} />
                          <Route path="/maintenance" element={<Maintenance />} />
                          <Route path="/transactions" element={<Transactions />} />
                          <Route path="/utilities" element={<Utilities />} />
                          <Route path="/utilities/electricity-readings" element={<ElectricityReadings />} />
                          <Route path="/reports" element={<Reports />} />
                          <Route path="/notifications" element={<Notifications />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/calendar" element={<Calendar />} />
                          <Route path="/settings" element={<Settings />} />
                        </Routes>
                      </div>
                    </div>
                  </main>
                </div>
              </RequireAuth>
            }
          />
        </Routes>
        <ToastViewport />
        <ConfirmDialogHost />
      </div>
    </I18nProvider>
  );
};

export default App;
