import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  HelpCircle,
  Menu,
  Moon,
  Package,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import '../styles/Layout.css';

const BRAND_NAME = 'Смарт лайф';
const API_URL = 'http://localhost:5000/api';

const mainNavItems = [
  { path: '/', label: 'Замовлення', icon: ClipboardList },
  { path: '/parts', label: 'Склад', icon: Package },
  { path: '/clients', label: 'Клієнти', icon: Users },
  { path: '/reports', label: 'Звіти', icon: BarChart3 },
  { path: '/finance', label: 'Фінанси', icon: CircleDollarSign },
  { path: '/settings', label: 'Налаштування', icon: Settings },
];

const summaryItems = [
  { label: 'Нове замовлення', status: 'прийнято', className: 'summary-blue' },
  { label: 'Діагностика', status: 'діагностика', className: 'summary-gray' },
  { label: 'Ремонт', status: 'ремонт', className: 'summary-orange' },
  { label: 'Виконано', status: 'виконано', className: 'summary-green' },
];

function SidebarLink({ item, isActive, onClick }) {
  const className = `sidebar-link ${isActive ? 'active' : ''}`;
  const Icon = item.icon;

  if (item.path.startsWith('#')) {
    return (
      <button className={className} type="button" onClick={() => onClick(item.dialog)} title={item.label}>
        <Icon className="sidebar-icon" size={22} strokeWidth={1.8} />
        <span>{item.label}</span>
      </button>
    );
  }

  const handleClick = (event) => {
    if (isActive || event.detail > 1) {
      event.preventDefault();
    }

    onClick();
  };

  return (
    <Link className={className} to={item.path} onClick={handleClick} title={item.label}>
      <Icon className="sidebar-icon" size={22} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

const Layout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [activeDialog, setActiveDialog] = useState(null);
  const [summaryCounts, setSummaryCounts] = useState({});
  const location = useLocation();
  const todayLabel = new Date()
    .toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace(' р.', '');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (event) => {
      if (event.detail === 'light' || event.detail === 'dark') {
        setTheme(event.detail);
      }
    };

    window.addEventListener('app-theme-change', handleThemeChange);
    return () => window.removeEventListener('app-theme-change', handleThemeChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const handleSidebarChange = (event) => {
      setSidebarCollapsed(Boolean(event.detail));
    };

    window.addEventListener('app-sidebar-collapse', handleSidebarChange);
    return () => window.removeEventListener('app-sidebar-collapse', handleSidebarChange);
  }, []);

  useEffect(() => {
    let isActive = true;

    const fetchSummaryCounts = async () => {
      try {
        const response = await axios.get(`${API_URL}/orders`);
        const counts = response.data.reduce((currentCounts, order) => {
          currentCounts[order.status] = (currentCounts[order.status] || 0) + 1;
          return currentCounts;
        }, {});

        if (isActive) {
          setSummaryCounts(counts);
        }
      } catch (error) {
        console.error('Не вдалося оновити підсумок замовлень:', error);
      }
    };

    fetchSummaryCounts();
    window.addEventListener('orders-summary-refresh', fetchSummaryCounts);

    return () => {
      isActive = false;
      window.removeEventListener('orders-summary-refresh', fetchSummaryCounts);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  const handleSearch = (event) => {
    window.dispatchEvent(new CustomEvent('app-search', { detail: event.target.value }));
  };

  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 1180px)').matches) {
      setSidebarOpen(true);
      return;
    }

    setSidebarCollapsed((isCollapsed) => !isCollapsed);
  };

  const openDialog = (title) => {
    setActiveDialog(title);
    setSidebarOpen(false);
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Link to="/" className="brand">
          <img className="brand-mark" src={theme === 'dark' ? '/images/darklogo.png' : '/images/logo.png'} alt="" aria-hidden="true" />
          <span className="brand-main">Смарт</span>
          <span className="brand-sub">лайф</span>
        </Link>

        <nav className="sidebar-nav">
          {mainNavItems.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              isActive={item.path === location.pathname}
              onClick={(dialog) => (dialog ? openDialog(dialog) : setSidebarOpen(false))}
            />
          ))}
        </nav>

        <div className="sidebar-card">
          <strong>Сьогодні</strong>
          <span>{todayLabel}</span>
          <div className="summary-list">
            {summaryItems.map((item) => (
              <div className="summary-item" key={item.label}>
                <span className={`summary-dot ${item.className}`}></span>
                <span>{item.label}</span>
                <strong>{summaryCounts[item.status] || 0}</strong>
              </div>
            ))}
          </div>
        </div>

        <button className="help-card" type="button" onClick={() => openDialog('Допомога')}>
          <HelpCircle className="sidebar-icon" size={22} strokeWidth={1.8} />
          <span>Допомога</span>
        </button>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" type="button" onClick={() => setSidebarOpen(false)} aria-label="Закрити меню" />}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={toggleSidebar} aria-label="Згорнути або відкрити меню">
            <Menu size={22} strokeWidth={1.9} />
          </button>

          <div className="topbar-search">
            <Search size={20} strokeWidth={1.8} />
            <input type="search" placeholder="Пошук замовлення, клієнта, пристрою..." onChange={handleSearch} />
            <kbd>Ctrl + K</kbd>
          </div>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Увімкнути темну тему' : 'Увімкнути світлу тему'}
              title={theme === 'light' ? 'Темна тема' : 'Світла тема'}
            >
              <span className="theme-icon">{theme === 'light' ? <Moon size={19} strokeWidth={1.9} /> : <Sun size={19} strokeWidth={1.9} />}</span>
            </button>
            <div className="profile-menu">
              <img src="/images/avatar.png" alt="" />
              <div>
                <strong>{user?.username || 'Майстер'}</strong>
                <span>{user?.role || 'Адміністратор'}</span>
              </div>
              <button className="logout-button" type="button" onClick={onLogout} aria-label="Вийти" title="Вийти">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">{children}</main>
      </div>

      {activeDialog && (
        <div className="modal-overlay" onClick={() => setActiveDialog(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveDialog(null)} aria-label="Закрити">
              ×
            </button>
            <h3>{activeDialog}</h3>
            <div className="modal-scroll">
              <div className="about-info">
                <p>{activeDialog === 'Допомога' ? 'Для роботи з системою оберіть розділ у меню або скористайтесь пошуком у верхній панелі.' : null}</p>
                <p>{activeDialog !== 'Допомога' ? `Розділ "${activeDialog}" підготовлений у меню. Його можна розширити окремою сторінкою, коли буде потрібна логіка та дані.` : null}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
