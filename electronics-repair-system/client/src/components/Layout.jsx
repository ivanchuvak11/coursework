import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart3,
  Bell,
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
import logoUrl from '../assets/logo.png';
import darkLogoUrl from '../assets/darklogo.png';
import avatarUrl from '../assets/avatar.png';
import { isAdminRole, isManagerRole, isMasterRole } from '../utils/accessControl';
import { API_URL } from '../utils/api';
import '../styles/Layout.css';

const BRAND_NAME = 'Смарт лайф';

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

const partRequestStatusLabels = {
  нове: 'Нова заявка',
  замовлено: 'Замовлено',
  закрито: 'Закрито',
};

function formatTopbarDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const [partRequests, setPartRequests] = useState([]);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const canManagePartRequests = isAdminRole(user) || isManagerRole(user);
  const visibleNavItems = isMasterRole(user)
    ? mainNavItems.filter((item) => ['/', '/parts', '/clients', '/settings'].includes(item.path))
    : mainNavItems;
  const newPartRequestsCount = partRequests.filter((request) => request.status === 'нове').length;
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
        const response = await axios.get(`${API_URL}/api/orders`);
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

  useEffect(() => {
    if (!canManagePartRequests) {
      return undefined;
    }

    let isActive = true;

    const fetchPartRequests = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/part-requests`);
        if (isActive) {
          setPartRequests(response.data);
        }
      } catch (error) {
        console.error('Не вдалося завантажити заявки на деталі:', error);
      }
    };

    fetchPartRequests();
    window.addEventListener('part-requests-refresh', fetchPartRequests);
    const intervalId = window.setInterval(fetchPartRequests, 30000);

    return () => {
      isActive = false;
      window.removeEventListener('part-requests-refresh', fetchPartRequests);
      window.clearInterval(intervalId);
    };
  }, [canManagePartRequests]);

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

  const updatePartRequestStatus = async (requestId, status) => {
    try {
      const response = await axios.patch(`${API_URL}/api/part-requests/${requestId}/status`, { status });
      setPartRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === requestId ? response.data : request)),
      );

      if (status === 'замовлено') {
        const addPartDetail = {
            partName: response.data.part_name || response.data.requested_part_name || '',
            quantity: response.data.requested_quantity || '',
            category: response.data.category || '',
        };

        if (location.pathname !== '/parts') {
          navigate('/parts');
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('inventory-open-add-part', { detail: addPartDetail }));
          }, 0);
        } else {
          window.dispatchEvent(new CustomEvent('inventory-open-add-part', { detail: addPartDetail }));
        }

        setRequestsOpen(false);
      }
    } catch (error) {
      console.error('Не вдалося оновити заявку на деталі:', error);
      alert(error.response?.data?.error || 'Помилка оновлення заявки на деталі');
    }
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Link to="/" className="brand">
          <img className="brand-mark" src={theme === 'dark' ? darkLogoUrl : logoUrl} alt="" aria-hidden="true" />
          <span className="brand-main">Смарт</span>
          <span className="brand-sub">лайф</span>
        </Link>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => (
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
            {canManagePartRequests && (
              <div className="notification-wrapper">
                <button
                  className={`notification-button ${newPartRequestsCount > 0 ? 'has-notifications' : ''}`}
                  type="button"
                  onClick={() => setRequestsOpen((isOpen) => !isOpen)}
                  aria-label="Заявки на деталі"
                  title="Заявки на деталі"
                >
                  <Bell size={19} strokeWidth={1.9} />
                  {newPartRequestsCount > 0 && <span>{newPartRequestsCount}</span>}
                </button>

                {requestsOpen && (
                  <div className="notification-panel">
                    <div className="notification-panel-header">
                      <div>
                        <strong>Заявки на деталі</strong>
                        <small>{newPartRequestsCount} нових</small>
                      </div>
                      <button type="button" onClick={() => setRequestsOpen(false)} aria-label="Закрити">×</button>
                    </div>

                    <div className="notification-list">
                      {partRequests.length > 0 ? partRequests.map((request) => (
                        <article className={`notification-item status-${request.status}`} key={request.id}>
                          <div className="notification-item-title">
                            <strong>{request.part_name || request.requested_part_name || 'Нова деталь'}</strong>
                            <span>{partRequestStatusLabels[request.status] || request.status}</span>
                          </div>
                          <p>
                            {request.requested_quantity} шт. запросив {request.requested_by || 'майстер'}
                            {request.current_stock !== null && request.current_stock !== undefined ? `, залишок ${request.current_stock} шт.` : ''}
                          </p>
                          {request.comment && <small>{request.comment}</small>}
                          <div className="notification-meta">
                            <span>{formatTopbarDate(request.created_at)}</span>
                            {request.status === 'нове' ? (
                              <div>
                                <button type="button" onClick={() => updatePartRequestStatus(request.id, 'замовлено')}>
                                  Замовлено
                                </button>
                                <button type="button" onClick={() => updatePartRequestStatus(request.id, 'закрито')}>
                                  Закрити
                                </button>
                              </div>
                            ) : (
                              <span>{request.handled_by ? `обробив ${request.handled_by}` : 'оброблено'}</span>
                            )}
                          </div>
                        </article>
                      )) : (
                        <p className="notification-empty">Нових заявок на деталі немає.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
              <img src={avatarUrl} alt="" />
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
