import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/SharedDark.css';
import '../styles/OrdersList.css';

const API_URL = 'http://localhost:5000/api';

const ORDER_STATUSES = [
  { value: 'прийнято', label: 'Нове замовлення', shortLabel: 'Нове', className: 'status-accepted' },
  { value: 'діагностика', label: 'Діагностика', shortLabel: 'Діагностика', className: 'status-diagnostics' },
  { value: 'ремонт', label: 'Ремонт', shortLabel: 'Ремонт', className: 'status-repair' },
  { value: 'виконано', label: 'Виконано', shortLabel: 'Виконано', className: 'status-complete' },
  { value: 'видано', label: 'Видано', shortLabel: 'Видано', className: 'status-issued' },
];

const FALLBACK_ORDER = {
  id: 58,
  full_name: 'Іван Петренко',
  phone: '+38 (067) 123-45-67',
  email: 'ivan.petrenko@gmail.com',
  brand: 'iPhone',
  model: '13',
  device_type: 'Смартфон',
  issue_description: 'Не вмикається',
  status: 'прийнято',
  created_at: '2024-05-24T10:21:00',
};

const lowStockParts = [
  { name: 'Дисплей iPhone 13', type: 'OLED', quantity: 2, min: 5, image: '/images/logo.png' },
  { name: 'Акумулятор iPhone 11', type: 'Li-ion', quantity: 3, min: 5, image: '/images/favicon.png' },
  { name: 'Роз’єм зарядки USB-C', type: 'Універсальний', quantity: 4, min: 10, image: '/images/logo.png' },
  { name: 'Вентилятор ноутбука 15.6"', type: 'Універсальний', quantity: 1, min: 5, image: '/images/favicon.png' },
];

const SORTABLE_TEXT_FIELDS = ['full_name', 'phone', 'email', 'status'];

const getStatusMeta = (status) => ORDER_STATUSES.find((item) => item.value === status) || ORDER_STATUSES[0];

function getOrderNumber(id) {
  return `RM-2024-${String(id || 0).padStart(4, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeviceName(order) {
  return `${order.brand || ''} ${order.model || ''}`.trim() || 'Не вказано';
}

function getSortValue(order, field) {
  if (field === 'id') return Number(order.id);
  if (field === 'device') return getDeviceName(order).toLowerCase();
  if (field === 'issue') return String(order.issue_description || '').toLowerCase();
  if (SORTABLE_TEXT_FIELDS.includes(field)) return String(order[field] || '').toLowerCase();
  return order[field] || '';
}

function EditableField({ isEditing, type = 'text', value, editValue, onEdit, onChange, onSave, onCancel }) {
  if (isEditing) {
    return (
      <div className="inline-edit">
        <input type={type} value={editValue} onChange={(event) => onChange(event.target.value)} autoFocus />
        <button className="icon-action success" type="button" onClick={onSave} aria-label="Зберегти">
          ✓
        </button>
        <button className="icon-action danger" type="button" onClick={onCancel} aria-label="Скасувати">
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="editable-value">
      <span>{value || '—'}</span>
      <button className="icon-action ghost" type="button" onClick={onEdit} aria-label="Редагувати">
        ✎
      </button>
    </div>
  );
}

function PrintReceipt({ order }) {
  const status = getStatusMeta(order.status);

  return (
    <article className="print-receipt" aria-hidden="true">
      <header className="receipt-header">
        <div>
          <h1>Самарт лайф</h1>
          <p>Сервісний центр ремонту електроніки</p>
        </div>
        <div className="receipt-number">
          <strong>Квитанція</strong>
          <span>Замовлення № {getOrderNumber(order.id)}</span>
        </div>
      </header>

      <section className="receipt-meta">
        <div>
          <span>Дата</span>
          <strong>{formatDate(order.created_at)}</strong>
        </div>
        <div>
          <span>Статус</span>
          <strong>{status.label}</strong>
        </div>
      </section>

      <section className="receipt-section">
        <h2>Дані клієнта</h2>
        <div className="receipt-grid">
          <span>Клієнт</span>
          <strong>{order.full_name || '—'}</strong>
          <span>Телефон</span>
          <strong>{order.phone || '—'}</strong>
          <span>Email</span>
          <strong>{order.email || '—'}</strong>
        </div>
      </section>

      <section className="receipt-section">
        <h2>Пристрій</h2>
        <div className="receipt-grid">
          <span>Пристрій</span>
          <strong>{getDeviceName(order)}</strong>
          <span>Тип</span>
          <strong>{order.device_type || '—'}</strong>
          <span>Несправність</span>
          <strong>{order.issue_description || 'Не вказано'}</strong>
        </div>
      </section>

      <table className="receipt-table">
        <thead>
          <tr>
            <th>Послуга</th>
            <th>Кількість</th>
            <th>Вартість</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Діагностика та прийом пристрою</td>
            <td>1</td>
            <td>За домовленістю</td>
          </tr>
        </tbody>
      </table>

      <div className="receipt-total">
        <span>Орієнтовна вартість</span>
        <strong>За результатами діагностики</strong>
      </div>

      <footer className="receipt-signatures">
        <div>
          <span></span>
          <p>Підпис клієнта</p>
        </div>
        <div>
          <span></span>
          <p>Підпис майстра</p>
        </div>
      </footer>
    </article>
  );
}

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState(13);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(true);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_URL}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Не вдалося завантажити замовлення:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const handleSearch = (event) => {
      setSearch(String(event.detail || ''));
    };

    window.addEventListener('app-search', handleSearch);
    return () => window.removeEventListener('app-search', handleSearch);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, pageSize, search]);

  const updateStatus = async (order, status) => {
    try {
      await axios.put(`${API_URL}/orders/${order.id}/status`, { status });

      try {
        await axios.post(`${API_URL}/send-status-sms`, {
          phone: order.phone,
          orderId: order.id,
          status,
          clientName: order.full_name,
          clientEmail: order.email,
        });
      } catch {
        console.info('SMS-сповіщення не відправлено');
      }

      setOrders((currentOrders) => currentOrders.map((item) => (item.id === order.id ? { ...item, status } : item)));
      setSelectedOrder((currentOrder) => (currentOrder?.id === order.id ? { ...currentOrder, status } : currentOrder));
    } catch (error) {
      console.error('Не вдалося оновити статус:', error);
      alert('Помилка оновлення статусу');
    }
  };

  const updateClientField = async (clientId, field, value) => {
    if (!clientId) {
      alert('ID клієнта не знайдено');
      return;
    }

    try {
      await axios.put(`${API_URL}/clients/${clientId}`, { [field]: value });
      setEditingField(null);
      setEditValue('');
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.client_id === clientId ? { ...order, [field]: value } : order)),
      );
      setSelectedOrder((order) => (order ? { ...order, [field]: value } : order));
    } catch (error) {
      console.error('Не вдалося оновити дані клієнта:', error);
      alert('Помилка оновлення даних клієнта');
    }
  };

  const handleEditClick = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortOrder('asc');
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length };
    ORDER_STATUSES.forEach((status) => {
      counts[status.value] = orders.filter((order) => order.status === status.value).length;
    });
    return counts;
  }, [orders]);

  const sortedOrders = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return orders
      .filter((order) => {
        const matchesSearch =
          !normalizedSearch ||
          getOrderNumber(order.id).toLowerCase().includes(normalizedSearch) ||
          (order.full_name || '').toLowerCase().includes(normalizedSearch) ||
          (order.phone || '').includes(search) ||
          getDeviceName(order).toLowerCase().includes(normalizedSearch);
        const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aValue = getSortValue(a, sortField);
        const bValue = getSortValue(b, sortField);

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [filterStatus, orders, search, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const visibleFrom = sortedOrders.length ? (currentPage - 1) * pageSize + 1 : 0;
  const visibleTo = Math.min(currentPage * pageSize, sortedOrders.length);
  const activeOrder = selectedOrder || paginatedOrders[0] || sortedOrders[0] || orders[0] || FALLBACK_ORDER;
  const activeStatus = getStatusMeta(activeOrder.status);

  const cancelOrder = () => {
    if (!activeOrder?.id || !confirm(`Скасувати замовлення ${getOrderNumber(activeOrder.id)}?`)) return;
    setOrders((currentOrders) => currentOrders.filter((order) => order.id !== activeOrder.id));
    setSelectedOrder(null);
    alert('Замовлення прибрано зі списку в поточній сесії. Для постійного видалення потрібен DELETE endpoint на сервері.');
  };

  const printReceipt = () => {
    window.print();
  };

  const focusActiveOrder = () => {
    document.querySelector('.orders-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return <div className="loading">Завантаження...</div>;
  }

  return (
    <div className={`orders-page repair-dashboard ${showDetails ? '' : 'details-collapsed'}`}>
      <section className="orders-main-panel">
        <div className="orders-toolbar">
          <h1>Замовлення</h1>
          <Link className="new-order-button" to="/new-order">
            Нове замовлення <span>+</span>
          </Link>
        </div>

        <div className="status-tabs">
          <button className={filterStatus === 'all' ? 'active' : ''} type="button" onClick={() => setFilterStatus('all')}>
            Усі <span>{statusCounts.all}</span>
          </button>
          {ORDER_STATUSES.slice(0, 4).map((status) => (
            <button
              className={filterStatus === status.value ? 'active' : ''}
              key={status.value}
              type="button"
              onClick={() => setFilterStatus(status.value)}
            >
              <i className={status.className}></i>
              {status.label}
              <span>{statusCounts[status.value] || 0}</span>
            </button>
          ))}
          <button className={`filter-button ${filterOpen ? 'active' : ''}`} type="button" onClick={() => setFilterOpen((isOpen) => !isOpen)}>
            ⌯ Фільтр
          </button>
        </div>

        {filterOpen && (
          <div className="filter-panel">
            <label>
              Статус
              <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                <option value="all">Усі статуси</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Сортувати
              <select value={sortField} onChange={(event) => setSortField(event.target.value)}>
                <option value="id">Номер</option>
                <option value="created_at">Дата</option>
                <option value="full_name">Клієнт</option>
                <option value="device">Пристрій</option>
                <option value="status">Статус</option>
              </select>
            </label>
            <button type="button" onClick={() => { setFilterStatus('all'); setSortField('id'); setSortOrder('desc'); }}>
              Скинути
            </button>
          </div>
        )}

        <div className="table-responsive orders-table-card">
          <table className="orders-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')}>№ замовлення {getSortIcon('id')}</th>
                <th onClick={() => handleSort('created_at')}>Дата {getSortIcon('created_at')}</th>
                <th onClick={() => handleSort('full_name')}>Клієнт {getSortIcon('full_name')}</th>
                <th onClick={() => handleSort('device')}>Пристрій {getSortIcon('device')}</th>
                <th onClick={() => handleSort('issue')}>Несправність {getSortIcon('issue')}</th>
                <th onClick={() => handleSort('status')}>Статус {getSortIcon('status')}</th>
                <th>Майстер</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order, index) => {
                const status = getStatusMeta(order.status);
                const isSelected = activeOrder.id === order.id;

                return (
                  <tr className={isSelected ? 'selected' : ''} key={order.id} onClick={() => { setSelectedOrder(order); setShowDetails(true); }}>
                    <td>
                      <button className="order-number" type="button">
                        {getOrderNumber(order.id)}
                      </button>
                    </td>
                    <td>{formatDate(order.created_at)}</td>
                    <td>{order.full_name || '—'}</td>
                    <td>{getDeviceName(order)}</td>
                    <td>{order.issue_description || 'Не вказано'}</td>
                    <td>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                    </td>
                    <td>{((currentPage - 1) * pageSize + index) % 3 === 0 ? '—' : index % 2 === 0 ? 'Олег Т.' : 'Андрій К.'}</td>
                    <td>
                      <select
                        value={order.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateStatus(order, event.target.value)}
                        aria-label="Змінити статус"
                      >
                        {ORDER_STATUSES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="orders-footer-row">
          <span>Показано {visibleFrom}-{visibleTo} з {sortedOrders.length}</span>
          <div className="pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>‹</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((page) => (
              <button className={currentPage === page ? 'active' : ''} key={page} type="button" onClick={() => setCurrentPage(page)}>
                {page}
              </button>
            ))}
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>›</button>
          </div>
          <select value={pageSize} aria-label="Кількість на сторінці" onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={13}>13 / стор.</option>
            <option value={25}>25 / стор.</option>
            <option value={50}>50 / стор.</option>
          </select>
        </div>

        <section className="stock-panel">
          <div className="stock-header">
            <h2>Склад - низький залишок</h2>
            <Link to="/parts">Весь склад</Link>
          </div>
          <div className="stock-grid">
            {lowStockParts.map((part) => (
              <article className="stock-card" key={part.name}>
                <img src={part.image} alt="" />
                <div>
                  <h3>{part.name}</h3>
                  <p>{part.type}</p>
                  <strong>Залишок: {part.quantity} шт.</strong>
                  <span>Мін. залишок: {part.min} шт.</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {showDetails && <aside className="order-details-panel">
        <div className="details-header">
          <h2>Деталі замовлення</h2>
          <button type="button" aria-label="Закрити" onClick={() => setShowDetails(false)}>×</button>
        </div>

        <div className="details-title-block">
          <h3>{getOrderNumber(activeOrder.id)}</h3>
          <span className={`status-badge ${activeStatus.className}`}>{activeStatus.label}</span>
          <dl>
            <div>
              <dt>Прийнято:</dt>
              <dd>{formatDate(activeOrder.created_at)}</dd>
            </div>
            <div>
              <dt>Орієнтовно:</dt>
              <dd>—</dd>
            </div>
          </dl>
        </div>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Клієнт</h4>
            <button type="button" onClick={() => handleEditClick('phone', activeOrder.phone)}>✎</button>
          </div>
          <div className="details-list">
            <div>
              <span>ПІБ:</span>
              <strong>{activeOrder.full_name || '—'}</strong>
            </div>
            <div>
              <span>Телефон:</span>
              <EditableField
                isEditing={editingField === 'phone'}
                value={activeOrder.phone}
                editValue={editValue}
                onEdit={() => handleEditClick('phone', activeOrder.phone)}
                onChange={setEditValue}
                onSave={() => updateClientField(activeOrder.client_id, 'phone', editValue)}
                onCancel={() => setEditingField(null)}
              />
            </div>
            <div>
              <span>Email:</span>
              <EditableField
                isEditing={editingField === 'email'}
                type="email"
                value={activeOrder.email}
                editValue={editValue}
                onEdit={() => handleEditClick('email', activeOrder.email)}
                onChange={setEditValue}
                onSave={() => updateClientField(activeOrder.client_id, 'email', editValue)}
                onCancel={() => setEditingField(null)}
              />
            </div>
            <div>
              <span>Адреса:</span>
              <strong>м. Київ, вул. Хрещатик, 15</strong>
            </div>
          </div>
        </section>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Пристрій</h4>
            <button type="button" onClick={() => alert('Редагування пристрою потребує endpoint для оновлення devices на сервері.')}>✎</button>
          </div>
          <div className="details-list">
            <div>
              <span>Пристрій:</span>
              <strong>{getDeviceName(activeOrder)}</strong>
            </div>
            <div>
              <span>Серійний номер:</span>
              <strong>DNPD93JQ0D</strong>
            </div>
            <div>
              <span>Колір:</span>
              <strong>Midnight</strong>
            </div>
            <div>
              <span>Комплектація:</span>
              <strong>Телефон, кабель</strong>
            </div>
          </div>
        </section>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Несправність</h4>
          </div>
          <p className="issue-text">{activeOrder.issue_description || 'Не вказано'}</p>
          <div className="details-list single">
            <div>
              <span>Додатково:</span>
              <strong>Клієнт не знає причину</strong>
            </div>
          </div>
        </section>

        <section className="details-actions">
          <h4>Дії</h4>
          <button className="primary-action" type="button" onClick={focusActiveOrder}>Перейти до замовлення</button>
          <button type="button" onClick={printReceipt}>Друк квитанції</button>
          <button className="danger-action" type="button" onClick={cancelOrder}>Скасувати замовлення</button>
        </section>
      </aside>}

      <PrintReceipt order={activeOrder} />
    </div>
  );
}
