import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../utils/api';
import { AVERAGE_REPAIR_PRICE_STORAGE_KEY, getStoredAverageRepairPrice } from '../utils/financeSettings';
import '../styles/SharedDark.css';
import '../styles/SectionPages.css';

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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const orderTime = new Date(order.created_at).getTime();
    if (Number.isNaN(orderTime)) return true;

    if (dateFrom) {
      const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
      if (orderTime < fromTime) return false;
    }

    if (dateTo) {
      const toTime = new Date(`${dateTo}T23:59:59`).getTime();
      if (orderTime > toTime) return false;
    }

    return true;
  }), [dateFrom, dateTo, orders]);

  const stats = useMemo(() => {
    const completedStatuses = ['виконано', 'видано'];
    const activeStatuses = ['прийнято', 'діагностика', 'ремонт'];
    const byStatus = filteredOrders.reduce((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});
    const deviceCounts = filteredOrders.reduce((counts, order) => {
      const device = `${order.brand || ''} ${order.model || ''}`.trim() || 'Не вказано';
      counts[device] = (counts[device] || 0) + 1;
      return counts;
    }, {});
    const topDevices = Object.entries(deviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const completedOrders = filteredOrders.filter((order) => completedStatuses.includes(order.status));
    const masterMap = new Map();
    const usedPartMap = new Map();

    filteredOrders.forEach((order) => {
      const masterName = order.master_name || 'Не призначено';
      const masterStats = masterMap.get(masterName) || { total: 0, completed: 0, revenue: 0 };
      masterStats.total += 1;

      if (completedStatuses.includes(order.status)) {
        masterStats.completed += 1;
        masterStats.revenue += Number(order.repair_price || 0);
      }

      masterMap.set(masterName, masterStats);

      (order.used_parts || []).forEach((part) => {
        const partName = part.part_name || 'Деталь';
        const quantity = Number(part.quantity_used || 0);
        const partStats = usedPartMap.get(partName) || { quantity: 0, total: 0 };
        partStats.quantity += quantity;
        partStats.total += quantity * Number(part.price_at_time || 0);
        usedPartMap.set(partName, partStats);
      });
    });

    return {
      byStatus,
      topDevices,
      activeOrders: filteredOrders.filter((order) => activeStatuses.includes(order.status)).length,
      completedOrders: completedOrders.length,
      issuedOrders: filteredOrders.filter((order) => order.status === 'видано').length,
      revenue: completedOrders.reduce((sum, order) => sum + Number(order.repair_price || 0), 0),
      masterLoad: [...masterMap.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.total - a.total),
      usedParts: [...usedPartMap.entries()]
        .map(([name, value]) => ({ name, ...value }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      lowStock: parts.filter((part) => Number(part.quantity) < 5),
    };
  }, [filteredOrders, parts]);

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <SectionShell title="Звіти" description="Огляд роботи майстерні за замовленнями, майстрами, доходом і деталями.">
      <div className="section-card report-filter-card">
        <div className="section-tools report-tools">
          <label>
            Від
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label>
            До
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <strong>{filteredOrders.length} замовлень у вибірці</strong>
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Скинути
          </button>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Усього за період</span>
          <strong>{filteredOrders.length}</strong>
        </article>
        <article className="metric-card">
          <span>У роботі</span>
          <strong>{stats.activeOrders}</strong>
        </article>
        <article className="metric-card">
          <span>Виконано / видано</span>
          <strong>{stats.completedOrders}</strong>
        </article>
        <article className="metric-card">
          <span>Дохід за період</span>
          <strong>{formatMoney(stats.revenue)}</strong>
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
            {stats.topDevices.length > 0 ? stats.topDevices.map(([device, count]) => (
              <div key={device}>
                <span>{device}</span>
                <strong>{count}</strong>
              </div>
            )) : <p className="empty-report">Даних за вибраний період немає.</p>}
          </div>
        </div>
      </div>

      <div className="section-grid two-columns report-secondary-grid">
        <div className="section-card">
          <h2>Завантаження майстрів</h2>
          <div className="report-list">
            {stats.masterLoad.length > 0 ? stats.masterLoad.map((master) => (
              <div key={master.name}>
                <span>{master.name}</span>
                <strong>{master.total} / {master.completed} виконано</strong>
              </div>
            )) : <p className="empty-report">Немає призначених замовлень.</p>}
          </div>
        </div>
        <div className="section-card">
          <h2>Деталі та склад</h2>
          <div className="report-list">
            {stats.usedParts.length > 0 ? stats.usedParts.map((part) => (
              <div key={part.name}>
                <span>{part.name}</span>
                <strong>{part.quantity} шт. / {formatMoney(part.total)}</strong>
              </div>
            )) : <p className="empty-report">Деталі у вибраних замовленнях не використовувалися.</p>}
          </div>
          {stats.lowStock.length > 0 && (
            <p className="report-note">
              Низький залишок: {stats.lowStock.map((part) => `${part.part_name} (${part.quantity} шт.)`).join(', ')}
            </p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}

export function FinancePage() {
  const { orders, parts, loading } = useDashboardData();
  const [averageRepairPrice, setAverageRepairPrice] = useState(getStoredAverageRepairPrice);

  useEffect(() => {
    localStorage.setItem(AVERAGE_REPAIR_PRICE_STORAGE_KEY, String(averageRepairPrice));
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
