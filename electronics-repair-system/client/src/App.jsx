import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import OrdersList from './components/OrdersList';
import NewOrderForm from './components/NewOrderForm';
import PartsInventory from './components/PartsInventory';
import { ClientsPage, FinancePage, ReportsPage, SettingsPage } from './components/SectionPages';
import { isMasterRole } from './utils/accessControl';
import './App.css';

function AuthenticatedApp({ user, onLogout }) {
  const location = useLocation();
  const isMaster = isMasterRole(user);

  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Layout user={user} onLogout={onLogout}>
        <Routes>
          <Route path="/" element={<OrdersList user={user} />} />
          {!isMaster && <Route path="/new-order" element={<NewOrderForm />} />}
          <Route path="/parts" element={<PartsInventory user={user} />} />
          <Route path="/clients" element={<ClientsPage />} />
          {!isMaster && <Route path="/reports" element={<ReportsPage />} />}
          {!isMaster && <Route path="/finance" element={<FinancePage />} />}
          <Route path="/settings" element={<SettingsPage user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/auth/me');
      setUser(response.data);
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/api/auth/logout');
    } catch {
      console.info('Сесію на сервері вже завершено або сервер недоступний');
    }
    
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container full-screen-loader">
        <div className="spinner"></div>
        <p>Завантаження...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <AuthenticatedApp user={user} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

export default App;
