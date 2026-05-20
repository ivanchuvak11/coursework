import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CircleDollarSign,
  ClipboardList,
  HelpCircle,
  Menu,
  MessageSquare,
  Moon,
  Package,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import '../styles/Layout.css';

const BRAND_NAME = 'Самарт лайф';

const mainNavItems = [
  { path: '/', label: 'Замовлення', icon: ClipboardList },
  { path: '/parts', label: 'Склад', icon: Package },
  { path: '#clients', label: 'Клієнти', icon: Users },
  { path: '#reports', label: 'Звіти', icon: BarChart3 },
  { path: '#finance', label: 'Фінанси', icon: CircleDollarSign },
  { path: '#settings', label: 'Налаштування', icon: Settings },
];

const summaryItems = [
  { label: 'Нове замовлення', value: 12, className: 'summary-blue' },
  { label: 'Діагностика', value: 8, className: 'summary-gray' },
  { label: 'Ремонт', value: 15, className: 'summary-orange' },
  { label: 'Виконано', value: 23, className: 'summary-green' },
];

function SidebarLink({ item, isActive, onClick }) {
  const className = `sidebar-link ${isActive ? 'active' : ''}`;
  const Icon = item.icon;

  if (item.path.startsWith('#')) {
    return (
      <button className={className} type="button" onClick={onClick}>
        <Icon className="sidebar-icon" size={22} strokeWidth={1.8} />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <Link className={className} to={item.path} onClick={onClick}>
      <Icon className="sidebar-icon" size={22} strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
}

const Layout = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
  };

  const handleSearch = (event) => {
    window.dispatchEvent(new CustomEvent('app-search', { detail: event.target.value }));
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="brand-main">Самарт</span>
          <span className="brand-sub">лайф</span>
        </Link>

        <nav className="sidebar-nav">
          {mainNavItems.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              isActive={item.path === location.pathname}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="sidebar-card">
          <strong>Сьогодні</strong>
          <span>24 травня 2024</span>
          <div className="summary-list">
            {summaryItems.map((item) => (
              <div className="summary-item" key={item.label}>
                <span className={`summary-dot ${item.className}`}></span>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <button className="help-card" type="button">
          <HelpCircle className="sidebar-icon" size={22} strokeWidth={1.8} />
          <span>Допомога</span>
        </button>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" type="button" onClick={() => setSidebarOpen(false)} aria-label="Закрити меню" />}

      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Відкрити меню">
            <Menu size={22} strokeWidth={1.9} />
          </button>

          <div className="topbar-search">
            <Search size={20} strokeWidth={1.8} />
            <input type="search" placeholder="Пошук замовлення, клієнта, пристрою..." onChange={handleSearch} />
            <kbd>Ctrl + K</kbd>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Сповіщення">
              <Bell size={20} strokeWidth={1.8} />
            </button>
            <button className="icon-button" type="button" aria-label="Повідомлення">
              <MessageSquare size={20} strokeWidth={1.8} />
            </button>
            <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Змінити тему">
              <span>{theme === 'light' ? <Moon size={18} strokeWidth={1.9} /> : <Sun size={18} strokeWidth={1.9} />}</span>
              <strong>{theme === 'light' ? 'Темна' : 'Світла'}</strong>
            </button>
            <div className="profile-menu">
              <img src="/images/avatar.png" alt="" />
              <div>
                <strong>{user?.username || 'Майстер'}</strong>
                <span>Адміністратор</span>
              </div>
              <button type="button" onClick={onLogout} aria-label="Вийти">
                ˅
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
