import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { getToken, setToken } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BotEditor from './pages/BotEditor';

function Private({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="app">
      <div className="topbar">
        <Link to="/" className="brand">
          <span className="brand-dot" /> TeleBot&nbsp;Constructor
        </Link>
        <div className="spacer" />
        <button
          className="topbar-link"
          onClick={() => {
            setToken(null);
            location.href = '/login';
          }}
        >
          Выйти
        </button>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Private>
            <Shell>
              <Dashboard />
            </Shell>
          </Private>
        }
      />
      <Route
        path="/bots/:botId/*"
        element={
          <Private>
            <BotEditor />
          </Private>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
