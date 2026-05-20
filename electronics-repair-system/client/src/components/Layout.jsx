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
  X,
} from 'lucide-react';
import '../styles/Layout.css';

const BRAND_NAME = 'Самарт лайф';

const mainNavItems = [
  { path: '/', label: 'Замовлення', icon: ClipboardList },
  { path: '/parts', label: 'Склад', icon: Package },
  { path: '#clients', label: 'Клієнти', icon: Users, dialog: 'Клієнти' },
  { path: '#reports', label: 'Звіти', icon: BarChart3, dialog: 'Звіти' },
  { path: '#finance', label: 'Фінанси', icon: CircleDollarSign, dialog: 'Фінанси' },
  { path: '#settings', label: 'Налаштування', icon: Settings, dialog: 'Налаштування' },
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
      <button className={className} type="button" onClick={() => onClick(item.dialog)} title={item.label}>
        <Icon className="sidebar-icon" size={22} strokeWidth={1.8} />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <Link className={className} to={item.path} onClick={onClick} title={item.label}>
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
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

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
          <img className="brand-mark" src="/images/logo.png" alt="" aria-hidden="true" />
          <span className="brand-main">Самарт</span>
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
                <strong>{item.value}</strong>
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
            <button className="icon-button" type="button" aria-label="Сповіщення" onClick={() => openDialog('Сповіщення')}>
              <Bell size={20} strokeWidth={1.8} />
            </button>
            <button className="icon-button" type="button" aria-label="Повідомлення" onClick={() => openDialog('Повідомлення')}>
              <MessageSquare size={20} strokeWidth={1.8} />
            </button>
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
                <span>Адміністратор</span>
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
                <p>{activeDialog === 'Сповіщення' ? 'Нових критичних сповіщень немає.' : null}</p>
                <p>{activeDialog === 'Повідомлення' ? 'Непрочитаних повідомлень немає.' : null}</p>
                <p>{activeDialog === 'Допомога' ? 'Для роботи з системою оберіть розділ у меню або скористайтесь пошуком у верхній панелі.' : null}</p>
                <p>{!['Сповіщення', 'Повідомлення', 'Допомога'].includes(activeDialog) ? `Розділ "${activeDialog}" підготовлений у меню. Його можна розширити окремою сторінкою, коли буде потрібна логіка та дані.` : null}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
