import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import logoUrl from '../assets/logo.png';
import darkLogoUrl from '../assets/darklogo.png';
import { isAdminRole, isManagerRole, isMasterRole } from '../utils/accessControl';
import { getStoredAverageRepairPrice } from '../utils/financeSettings';
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
const COMPLETED_STATUS = ORDER_STATUSES.find((status) => status.className === 'status-complete').value;
const ISSUED_STATUS = ORDER_STATUSES.find((status) => status.className === 'status-issued').value;

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

const SORTABLE_TEXT_FIELDS = ['full_name', 'phone', 'email', 'status'];
const EMPTY_COMPLETION_PART = { partId: '', quantity: 1 };

const getStatusMeta = (status) => ORDER_STATUSES.find((item) => item.value === status) || ORDER_STATUSES[0];

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} грн`;
}

function getOrderPartsTotal(order) {
  return (order.used_parts || []).reduce(
    (total, part) => total + Number(part.price_at_time || 0) * Number(part.quantity_used || 0),
    0,
  );
}

function getOrderLaborPrice(order) {
  const savedLaborPrice = Number(order.labor_price || 0);
  if (savedLaborPrice > 0) return savedLaborPrice;

  return Math.max(Number(order.repair_price || 0) - getOrderPartsTotal(order), 0);
}

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

function getSerialNumber(order) {
  const seed = `${order.id || 0}-${order.created_at || ''}-${order.brand || ''}-${order.model || ''}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `SL${String(order.id || 0).padStart(4, '0')}${hash.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
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
          <h1>
            <span className="receipt-brand-main">Смарт</span><span className="receipt-brand-sub">лайф</span>
          </h1>
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
          {order.used_parts?.map((part) => (
            <tr key={`${part.part_id}-${part.part_name}`}>
              <td>{part.part_name}</td>
              <td>{part.quantity_used}</td>
              <td>{formatMoney(Number(part.price_at_time || 0) * Number(part.quantity_used || 0))}</td>
            </tr>
          ))}
          {getOrderLaborPrice(order) > 0 && (
            <tr>
              <td>Робота майстра</td>
              <td>1</td>
              <td>{formatMoney(getOrderLaborPrice(order))}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="receipt-total">
        <span>{Number(order.repair_price) > 0 ? 'Вартість ремонту' : 'Орієнтовна вартість'}</span>
        <strong>{Number(order.repair_price) > 0 ? formatMoney(order.repair_price) : 'За результатами діагностики'}</strong>
      </div>

      {order.completion_comment && (
        <section className="receipt-section">
          <h2>Коментар</h2>
          <p>{order.completion_comment}</p>
        </section>
      )}

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

export default function OrdersList({ user }) {
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
  const isMaster = isMasterRole(user);
  const canCreateOrder = !isMaster;
  const canManageClient = !isMaster;
  const canDeleteOrder = isAdminRole(user);
  const canAssignMaster = isAdminRole(user) || isManagerRole(user);
  const statusOptions = isMaster ? ORDER_STATUSES.filter((status) => status.value !== ISSUED_STATUS) : ORDER_STATUSES;
  const [showDetails, setShowDetails] = useState(false);
  const [parts, setParts] = useState([]);
  const [masters, setMasters] = useState([]);
  const [completionOrder, setCompletionOrder] = useState(null);
  const [completionPrice, setCompletionPrice] = useState('');
  const [completionComment, setCompletionComment] = useState('');
  const [completionParts, setCompletionParts] = useState([EMPTY_COMPLETION_PART]);
  const [completionSaving, setCompletionSaving] = useState(false);

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
    const fetchParts = async () => {
      try {
        const response = await axios.get(`${API_URL}/parts`);
        setParts(response.data);
      } catch (error) {
        console.error('Не вдалося завантажити деталі для завершення ремонту:', error);
      }
    };

    fetchParts();
  }, []);

  useEffect(() => {
    if (!canAssignMaster) {
      setMasters([]);
      return undefined;
    }

    let isMounted = true;

    const fetchMasters = async () => {
      try {
        const response = await axios.get(`${API_URL}/masters`);
        if (isMounted) {
          setMasters(response.data);
        }
      } catch (error) {
        console.error('Не вдалося завантажити майстрів:', error);
      }
    };

    fetchMasters();

    return () => {
      isMounted = false;
    };
  }, [canAssignMaster]);

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

  useEffect(() => {
    if (selectedOrder && !orders.some((order) => order.id === selectedOrder.id)) {
      setSelectedOrder(null);
      setShowDetails(false);
    }
  }, [orders, selectedOrder]);

  useEffect(() => {
    if (!completionOrder) return undefined;

    const scrollY = window.scrollY;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [completionOrder]);

  const openCompletionDialog = (order) => {
    const existingParts = Array.isArray(order.used_parts) && order.used_parts.length
      ? order.used_parts.map((part) => ({ partId: String(part.part_id), quantity: Number(part.quantity_used || 1) }))
      : [EMPTY_COMPLETION_PART];
    const existingLaborPrice = getOrderLaborPrice(order);
    const defaultLaborPrice = existingLaborPrice > 0 ? existingLaborPrice : getStoredAverageRepairPrice();

    setCompletionOrder(order);
    setCompletionPrice(defaultLaborPrice > 0 ? String(defaultLaborPrice) : '');
    setCompletionComment(order.completion_comment || '');
    setCompletionParts(existingParts);
  };

  const updateStatus = async (order, status) => {
    if (status === COMPLETED_STATUS) {
      openCompletionDialog(order);
      return;
    }

    try {
      const response = await axios.put(`${API_URL}/orders/${order.id}/status`, { status });
      const updatedOrder = { ...order, ...response.data, status: response.data?.status || status };

      setOrders((currentOrders) => currentOrders.map((item) => (item.id === order.id ? { ...item, ...updatedOrder } : item)));
      setSelectedOrder((currentOrder) => (currentOrder?.id === order.id ? { ...currentOrder, ...updatedOrder } : currentOrder));
      window.dispatchEvent(new Event('orders-summary-refresh'));
    } catch (error) {
      console.error('Не вдалося оновити статус:', error);
      alert('Помилка оновлення статусу');
    }
  };

  const assignMaster = async (order, masterId) => {
    if (!masterId) return;

    try {
      const response = await axios.put(`${API_URL}/orders/${order.id}/master`, { masterId: Number(masterId) });
      const updatedOrder = { ...order, ...response.data };

      setOrders((currentOrders) => currentOrders.map((item) => (item.id === order.id ? { ...item, ...updatedOrder } : item)));
      setSelectedOrder((currentOrder) => (currentOrder?.id === order.id ? { ...currentOrder, ...updatedOrder } : currentOrder));
    } catch (error) {
      console.error('Не вдалося призначити майстра:', error);
      alert(error.response?.data?.error || 'Помилка призначення майстра');
    }
  };

  const updateCompletionPart = (index, field, value) => {
    setCompletionParts((currentParts) =>
      currentParts.map((part, partIndex) => (partIndex === index ? { ...part, [field]: value } : part)),
    );
  };

  const addCompletionPart = () => {
    setCompletionParts((currentParts) => [...currentParts, EMPTY_COMPLETION_PART]);
  };

  const removeCompletionPart = (index) => {
    setCompletionParts((currentParts) => currentParts.filter((_, partIndex) => partIndex !== index));
  };

  const closeCompletionDialog = () => {
    setCompletionOrder(null);
    setCompletionPrice('');
    setCompletionComment('');
    setCompletionParts([EMPTY_COMPLETION_PART]);
  };

  const completeOrder = async (event) => {
    event.preventDefault();

    if (!completionOrder) return;

    try {
      setCompletionSaving(true);
      const response = await axios.put(`${API_URL}/orders/${completionOrder.id}/complete`, {
        laborPrice: completionPrice,
        comment: completionComment,
        usedParts: completionParts
          .filter((part) => part.partId && Number(part.quantity) > 0)
          .map((part) => ({ partId: Number(part.partId), quantity: Number(part.quantity) })),
      });

      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === completionOrder.id ? { ...order, ...response.data } : order)),
      );
      setSelectedOrder((currentOrder) => (currentOrder?.id === completionOrder.id ? { ...currentOrder, ...response.data } : currentOrder));
      window.dispatchEvent(new Event('orders-summary-refresh'));
      closeCompletionDialog();

      const partsResponse = await axios.get(`${API_URL}/parts`);
      setParts(partsResponse.data);
    } catch (error) {
      console.error('Не вдалося завершити замовлення:', error);
      alert(error.response?.data?.error || 'Помилка завершення замовлення');
    } finally {
      setCompletionSaving(false);
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
  const acceptedStatus = ORDER_STATUSES[0].value;
  const completedOrdersCount = statusCounts[COMPLETED_STATUS] || 0;
  const newOrdersCount = statusCounts[acceptedStatus] || 0;

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
  const activeOrder = selectedOrder;
  const printableOrder = activeOrder || FALLBACK_ORDER;
  const activeStatus = getStatusMeta(activeOrder?.status);
  const activeStatusHistory = Array.isArray(activeOrder?.status_history) ? activeOrder.status_history : [];
  const completionPartsTotal = completionParts.reduce((total, usedPart) => {
    const stockPart = parts.find((part) => String(part.id) === String(usedPart.partId));
    return total + Number(stockPart?.price || 0) * Number(usedPart.quantity || 0);
  }, 0);
  const completionLaborTotal = Number(completionPrice || 0);
  const completionFinalTotal = completionLaborTotal + completionPartsTotal;

  const cancelOrder = async () => {
    if (!activeOrder?.id || !confirm(`Скасувати замовлення ${getOrderNumber(activeOrder.id)}?`)) return;

    try {
      await axios.delete(`${API_URL}/orders/${activeOrder.id}`);
      setOrders((currentOrders) => currentOrders.filter((order) => order.id !== activeOrder.id));
      setSelectedOrder(null);
      setShowDetails(false);
      window.dispatchEvent(new Event('orders-summary-refresh'));
      alert('Замовлення повністю видалено з бази даних.');
    } catch (error) {
      console.error('Не вдалося видалити замовлення:', error);
      alert(error.response?.data?.error || 'Помилка видалення замовлення');
    }
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

  const isDetailsVisible = showDetails && Boolean(activeOrder);

  return (
    <div className={`orders-page repair-dashboard ${isDetailsVisible ? '' : 'details-collapsed'}`}>
      <section className="orders-main-panel">
        <section className="service-focus-banner" aria-label="Сервісний фокус">
          <div className="service-focus-content">
            <div className="service-focus-heading">
              <span className="service-focus-icon">
                <img className="service-focus-logo service-focus-logo-light" src={logoUrl} alt="" aria-hidden="true" />
                <img className="service-focus-logo service-focus-logo-dark" src={darkLogoUrl} alt="" aria-hidden="true" />
              </span>
              <div>
                <h2>
                  <span>Смарт</span>лайф
                </h2>
                <p>Швидше закривайте готові ремонти</p>
              </div>
            </div>
            <div className="service-focus-metrics">
              <div className="service-focus-metric">
                <CheckCircle2 size={24} strokeWidth={1.9} />
                <span>
                  <strong>{completedOrdersCount}</strong> виконано
                  <small>готові до видачі</small>
                </span>
              </div>
              <div className="service-focus-metric">
                <PlusCircle size={24} strokeWidth={1.9} />
                <span>
                  <strong>{newOrdersCount}</strong> нове
                  <small>потребує уваги</small>
                </span>
              </div>
            </div>
            {canCreateOrder && (
              <Link className="service-focus-action" to="/new-order">
                Створити замовлення <span>+</span>
              </Link>
            )}
          </div>
        </section>

        <div className="orders-toolbar">
          <h1>Замовлення</h1>
        </div>

        <div className="status-tabs">
          <button className={filterStatus === 'all' ? 'active' : ''} type="button" onClick={() => setFilterStatus('all')}>
            Усі <span>{statusCounts.all}</span>
          </button>
          {ORDER_STATUSES.map((status) => (
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
              {paginatedOrders.map((order) => {
                const status = getStatusMeta(order.status);
                const isSelected = selectedOrder?.id === order.id;

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
                    <td>
                      {canAssignMaster ? (
                        <select
                          className="master-select"
                          value={order.assigned_master_id || ''}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => assignMaster(order, event.target.value)}
                          aria-label="Призначити майстра"
                        >
                          <option value="">Не призначено</option>
                          {masters.map((master) => (
                            <option key={master.id} value={master.id}>
                              {master.full_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        order.master_name || '—'
                      )}
                    </td>
                    <td>
                      <select
                        value={order.status}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateStatus(order, event.target.value)}
                        aria-label="Змінити статус"
                      >
                        {statusOptions.map((item) => (
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
      </section>

      {isDetailsVisible && <aside className="order-details-panel">
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
          </div>
          <div className="details-list">
            <div>
              <span>ПІБ:</span>
              <strong>{activeOrder.full_name || '—'}</strong>
            </div>
            <div>
              <span>Телефон:</span>
              {canManageClient ? (
                <EditableField
                  isEditing={editingField === 'phone'}
                  value={activeOrder.phone}
                  editValue={editValue}
                  onEdit={() => handleEditClick('phone', activeOrder.phone)}
                  onChange={setEditValue}
                  onSave={() => updateClientField(activeOrder.client_id, 'phone', editValue)}
                  onCancel={() => setEditingField(null)}
                />
              ) : (
                <strong>{activeOrder.phone || '—'}</strong>
              )}
            </div>
            <div>
              <span>Email:</span>
              {canManageClient ? (
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
              ) : (
                <strong>{activeOrder.email || '—'}</strong>
              )}
            </div>
          </div>
        </section>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Пристрій</h4>
          </div>
          <div className="details-list">
            <div>
              <span>Пристрій:</span>
              <strong>{getDeviceName(activeOrder)}</strong>
            </div>
            <div>
              <span>Серійний номер:</span>
              <strong>{getSerialNumber(activeOrder)}</strong>
            </div>
          </div>
        </section>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Майстер</h4>
          </div>
          <div className="details-list">
            <div>
              <span>Відповідальний:</span>
              {canAssignMaster ? (
                <select
                  className="master-select details-master-select"
                  value={activeOrder.assigned_master_id || ''}
                  onChange={(event) => assignMaster(activeOrder, event.target.value)}
                  aria-label="Призначити майстра"
                >
                  <option value="">Не призначено</option>
                  {masters.map((master) => (
                    <option key={master.id} value={master.id}>
                      {master.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{activeOrder.master_name || '—'}</strong>
              )}
            </div>
          </div>
        </section>

        <section className="details-section">
          <div className="details-section-title">
            <h4>Несправність</h4>
          </div>
          <p className="issue-text">{activeOrder.issue_description || 'Не вказано'}</p>
        </section>

        {(Number(activeOrder.repair_price) > 0 || activeOrder.completion_comment || activeOrder.used_parts?.length > 0) && (
          <section className="details-section">
            <div className="details-section-title">
              <h4>Завершення ремонту</h4>
              <button className="section-text-action" type="button" onClick={() => openCompletionDialog(activeOrder)}>Змінити</button>
            </div>
            <div className="details-list">
              <div>
                <span>Робота:</span>
                <strong>{formatMoney(getOrderLaborPrice(activeOrder))}</strong>
              </div>
              {activeOrder.used_parts?.length > 0 && (
                <div>
                  <span>Деталі:</span>
                  <strong>
                    {activeOrder.used_parts
                      .map((part) => `${part.part_name || 'Деталь'} × ${part.quantity_used} (${formatMoney(Number(part.price_at_time || 0) * Number(part.quantity_used || 0))})`)
                      .join(', ')}
                  </strong>
                </div>
              )}
              <div>
                <span>Разом:</span>
                <strong>{formatMoney(activeOrder.repair_price)}</strong>
              </div>
              {activeOrder.completion_comment && (
                <div>
                  <span>Коментар:</span>
                  <strong>{activeOrder.completion_comment}</strong>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="details-section">
          <div className="details-section-title">
            <h4>Історія статусів</h4>
          </div>
          {activeStatusHistory.length > 0 ? (
            <div className="status-history-list">
              {activeStatusHistory.map((historyItem) => {
                const oldStatus = historyItem.old_status ? getStatusMeta(historyItem.old_status).label : 'Створено';
                const newStatus = getStatusMeta(historyItem.new_status).label;

                return (
                  <div className="status-history-item" key={historyItem.id || `${historyItem.new_status}-${historyItem.changed_at}`}>
                    <strong>{historyItem.old_status ? `${oldStatus} на ${newStatus}` : `Створено: ${newStatus}`}</strong>
                    <span>
                      {formatDate(historyItem.changed_at)}
                      {historyItem.changed_by ? `, ${historyItem.changed_by}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="issue-text">Історія зʼявиться після першої зміни статусу.</p>
          )}
        </section>

        <section className="details-actions">
          <h4>Дії</h4>
          {canAssignMaster && activeOrder.status === COMPLETED_STATUS && (
            <button className="primary-action issued-action" type="button" onClick={() => updateStatus(activeOrder, ISSUED_STATUS)}>
              Видати клієнту
            </button>
          )}
          <button className="primary-action" type="button" onClick={focusActiveOrder}>Перейти до замовлення</button>
          <button type="button" onClick={printReceipt}>Друк квитанції</button>
          {canDeleteOrder && (
            <button className="danger-action" type="button" onClick={cancelOrder}>Скасувати замовлення</button>
          )}
        </section>
      </aside>}

      {completionOrder && (
        <div className="completion-overlay" onClick={closeCompletionDialog}>
          <form className="completion-modal" onSubmit={completeOrder} onClick={(event) => event.stopPropagation()}>
            <div className="completion-header">
              <div>
                <span>Завершення ремонту</span>
                <h2>{getOrderNumber(completionOrder.id)}</h2>
              </div>
              <button type="button" onClick={closeCompletionDialog} aria-label="Закрити">
                ×
              </button>
            </div>

            <div className="completion-money-grid">
              <label className="completion-field">
                Вартість роботи
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={completionPrice}
                  onChange={(event) => setCompletionPrice(event.target.value)}
                  placeholder="Наприклад, 1500"
                  required
                />
              </label>
              <aside className="completion-total-card">
                <span>Кінцева вартість</span>
                <strong>{formatMoney(completionFinalTotal)}</strong>
                <small>Робота {formatMoney(completionLaborTotal)} + деталі {formatMoney(completionPartsTotal)}</small>
              </aside>
            </div>

            <div className="completion-parts">
              <div className="completion-parts-title">
                <strong>Використані деталі</strong>
                <button type="button" onClick={addCompletionPart}>
                  + Додати
                </button>
              </div>

              {completionParts.map((usedPart, index) => (
                <div className="completion-part-row" key={`${index}-${usedPart.partId}`}>
                  <select value={usedPart.partId} onChange={(event) => updateCompletionPart(index, 'partId', event.target.value)}>
                    <option value="">Без деталі</option>
                    {parts.map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.part_name} — {part.quantity} шт. — {formatMoney(part.price)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={usedPart.quantity}
                    onChange={(event) => updateCompletionPart(index, 'quantity', event.target.value)}
                    aria-label="Кількість"
                  />
                  <button type="button" onClick={() => removeCompletionPart(index)} disabled={completionParts.length === 1}>
                    ×
                  </button>
                  <span className="completion-part-price">
                    {formatMoney(
                      Number(parts.find((part) => String(part.id) === String(usedPart.partId))?.price || 0) *
                        Number(usedPart.quantity || 0),
                    )}
                  </span>
                </div>
              ))}
            </div>

            <label className="completion-field">
              Коментар
              <textarea
                rows="3"
                value={completionComment}
                onChange={(event) => setCompletionComment(event.target.value)}
                placeholder="Додаткова інформація за необхідністю"
              />
            </label>

            <div className="completion-actions">
              <button type="button" onClick={closeCompletionDialog}>
                Скасувати
              </button>
              <button className="primary-action" type="submit" disabled={completionSaving}>
                {completionSaving ? 'Збереження...' : 'Зберегти виконання'}
              </button>
            </div>
          </form>
        </div>
      )}

      <PrintReceipt order={printableOrder} />
    </div>
  );
}
