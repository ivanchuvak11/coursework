import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../styles/SharedDark.css';
import '../styles/SectionPages.css';

const API_URL = 'http://localhost:5000/api';

const statusLabels = {
  прийнято: 'Нове замовлення',
  діагностика: 'Діагностика',
  ремонт: 'Ремонт',
  виконано: 'Виконано',
  видано: 'Видано',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('uk-UA', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'UAH',
  });
}

function useDashboardData() {
  const [orders, setOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const [ordersResponse, partsResponse] = await Promise.all([
          axios.get(`${API_URL}/orders`),
          axios.get(`${API_URL}/parts`),
        ]);

        if (isMounted) {
          setOrders(ordersResponse.data);
          setParts(partsResponse.data);
        }
      } catch (error) {
        console.error('Не вдалося завантажити дані розділу:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    window.addEventListener('orders-summary-refresh', loadData);

    return () => {
      isMounted = false;
      window.removeEventListener('orders-summary-refresh', loadData);
    };
  }, []);

  return { orders, parts, loading };
}

function SectionShell({ title, description, children }) {
  return (
    <div className="section-page">
      <div className="section-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function ClientsPage() {
  const { orders, loading } = useDashboardData();
  const [search, setSearch] = useState('');

  const clients = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      if (!order.client_id) return;
      const current = map.get(order.client_id) || {
        id: order.client_id,
        full_name: order.full_name,
        phone: order.phone,
        email: order.email,
        orders: 0,
        active: 0,
        lastOrder: order.created_at,
      };

      current.orders += 1;
      current.active += order.status !== 'видано' ? 1 : 0;
      current.lastOrder = new Date(order.created_at) > new Date(current.lastOrder) ? order.created_at : current.lastOrder;
      map.set(order.client_id, current);
    });

    return [...map.values()].filter((client) => {
      const normalizedSearch = search.toLowerCase();
      return (
        !normalizedSearch ||
        client.full_name?.toLowerCase().includes(normalizedSearch) ||
        client.phone?.includes(search) ||
        client.email?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [orders, search]);

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <SectionShell title="Клієнти" description="База клієнтів формується з реальних замовлень системи.">
      <div className="section-card">
        <div className="section-tools">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Пошук клієнта, телефону або email" />
          <strong>{clients.length} клієнтів</strong>
        </div>
        <div className="table-responsive">
          <table className="section-table">
            <thead>
              <tr>
                <th>Клієнт</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Замовлень</th>
                <th>Активних</th>
                <th>Останнє звернення</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.full_name || '—'}</td>
                  <td>{client.phone || '—'}</td>
                  <td>{client.email || '—'}</td>
                  <td>{client.orders}</td>
                  <td>{client.active}</td>
                  <td>{client.lastOrder ? new Date(client.lastOrder).toLocaleDateString('uk-UA') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionShell>
  );
}

export function ReportsPage() {
  const { orders, parts, loading } = useDashboardData();

  const stats = useMemo(() => {
    const byStatus = orders.reduce((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});
    const deviceCounts = orders.reduce((counts, order) => {
      const device = `${order.brand || ''} ${order.model || ''}`.trim() || 'Не вказано';
      counts[device] = (counts[device] || 0) + 1;
      return counts;
    }, {});
    const topDevices = Object.entries(deviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      byStatus,
      topDevices,
      lowStock: parts.filter((part) => Number(part.quantity) < 5),
    };
  }, [orders, parts]);

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <SectionShell title="Звіти" description="Огляд роботи майстерні за поточними даними.">
      <div className="metric-grid">
        <article className="metric-card">
          <span>Усього замовлень</span>
          <strong>{orders.length}</strong>
        </article>
        <article className="metric-card">
          <span>У роботі</span>
          <strong>{orders.filter((order) => ['прийнято', 'діагностика', 'ремонт'].includes(order.status)).length}</strong>
        </article>
        <article className="metric-card">
          <span>Виконано</span>
          <strong>{stats.byStatus['виконано'] || 0}</strong>
        </article>
        <article className="metric-card">
          <span>Низький залишок</span>
          <strong>{stats.lowStock.length}</strong>
        </article>
      </div>

      <div className="section-grid two-columns">
        <div className="section-card">
          <h2>Статуси замовлень</h2>
          <div className="report-list">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status}>
                <span>{label}</span>
                <strong>{stats.byStatus[status] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="section-card">
          <h2>Популярні пристрої</h2>
          <div className="report-list">
            {stats.topDevices.map(([device, count]) => (
              <div key={device}>
                <span>{device}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

export function FinancePage() {
  const { orders, parts, loading } = useDashboardData();
  const [averageRepairPrice, setAverageRepairPrice] = useState(() => Number(localStorage.getItem('averageRepairPrice')) || 1200);

  useEffect(() => {
    localStorage.setItem('averageRepairPrice', String(averageRepairPrice));
  }, [averageRepairPrice]);

  const inventoryValue = parts.reduce((sum, part) => sum + Number(part.quantity || 0) * Number(part.price || 0), 0);
  const completedOrders = orders.filter((order) => ['виконано', 'видано'].includes(order.status)).length;
  const estimatedRevenue = completedOrders * averageRepairPrice;

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <SectionShell title="Фінанси" description="Орієнтовні фінансові показники на основі замовлень і складу.">
      <div className="metric-grid">
        <article className="metric-card">
          <span>Оцінка доходу</span>
          <strong>{formatMoney(estimatedRevenue)}</strong>
        </article>
        <article className="metric-card">
          <span>Вартість складу</span>
          <strong>{formatMoney(inventoryValue)}</strong>
        </article>
        <article className="metric-card">
          <span>Оплачених робіт</span>
          <strong>{completedOrders}</strong>
        </article>
      </div>

      <div className="section-card finance-calculator">
        <h2>Калькулятор середнього чека</h2>
        <label>
          Середня вартість ремонту
          <input
            type="number"
            min="0"
            value={averageRepairPrice}
            onChange={(event) => setAverageRepairPrice(Number(event.target.value))}
          />
        </label>
        <p>Розрахунок: виконані та видані замовлення × середній чек.</p>
      </div>
    </SectionShell>
  );
}

export function SettingsPage({ user }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [compactSidebar, setCompactSidebar] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  const applyTheme = (value) => {
    setTheme(value);
    window.dispatchEvent(new CustomEvent('app-theme-change', { detail: value }));
  };

  const applySidebar = (value) => {
    setCompactSidebar(value);
    window.dispatchEvent(new CustomEvent('app-sidebar-collapse', { detail: value }));
  };

  return (
    <SectionShell title="Налаштування" description="Персональні параметри робочого інтерфейсу.">
      <div className="section-grid two-columns">
        <div className="section-card settings-card">
          <h2>Тема</h2>
          <div className="segmented-control">
            <button className={theme === 'light' ? 'active' : ''} type="button" onClick={() => applyTheme('light')}>
              Світла
            </button>
            <button className={theme === 'dark' ? 'active' : ''} type="button" onClick={() => applyTheme('dark')}>
              Темна
            </button>
          </div>
        </div>

        <div className="section-card settings-card">
          <h2>Бічна панель</h2>
          <label className="toggle-row">
            <span>Запам’ятати згорнутий режим</span>
            <input type="checkbox" checked={compactSidebar} onChange={(event) => applySidebar(event.target.checked)} />
          </label>
        </div>

        <div className="section-card settings-card">
          <h2>Профіль</h2>
          <div className="profile-summary">
            <strong>{user?.username || 'Майстер'}</strong>
            <span>{user?.role || 'Адміністратор'}</span>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
