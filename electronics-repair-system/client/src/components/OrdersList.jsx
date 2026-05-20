import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../styles/SharedDark.css';
import '../styles/OrdersList.css';

const API_URL = 'http://localhost:5000/api';

const ORDER_STATUSES = [
  { value: 'прийнято', label: 'Прийнято', className: 'status-accepted' },
  { value: 'діагностика', label: 'Діагностика', className: 'status-diagnostics' },
  { value: 'ремонт', label: 'Ремонт', className: 'status-repair' },
  { value: 'виконано', label: 'Виконано', className: 'status-complete' },
  { value: 'видано', label: 'Видано', className: 'status-issued' },
];

const STATUS_CLASS_BY_VALUE = ORDER_STATUSES.reduce((map, status) => {
  map[status.value] = status.className;
  return map;
}, {});

const SORTABLE_TEXT_FIELDS = ['full_name', 'phone', 'email', 'status'];

function getSortValue(order, field) {
  if (field === 'id') return Number(order.id);
  if (field === 'device') return `${order.brand || ''} ${order.model || ''}`.toLowerCase();
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

      fetchOrders();
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

  const sortedOrders = useMemo(() => {
    const normalizedSearch = search.toLowerCase();

    return orders
      .filter((order) => {
        const matchesSearch =
          (order.full_name || '').toLowerCase().includes(normalizedSearch) || (order.phone || '').includes(search);
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

  if (loading) {
    return <div className="loading">Завантаження...</div>;
  }

  return (
    <div className="orders-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Список замовлень</h2>
          <p>Всього: {orders.length}</p>
        </div>

        <div className="filters-row">
          <input
            type="text"
            placeholder="Пошук за ім'ям або телефоном"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="all">Всі статуси</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div className="table-responsive">
          <table className="orders-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')}>ID {getSortIcon('id')}</th>
                <th onClick={() => handleSort('full_name')}>Клієнт {getSortIcon('full_name')}</th>
                <th onClick={() => handleSort('phone')}>Телефон {getSortIcon('phone')}</th>
                <th onClick={() => handleSort('email')}>Email {getSortIcon('email')}</th>
                <th onClick={() => handleSort('device')}>Пристрій {getSortIcon('device')}</th>
                <th onClick={() => handleSort('status')}>Статус {getSortIcon('status')}</th>
                <th>Дія</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>
                    <button className="client-link" type="button" onClick={() => setSelectedOrder(order)}>
                      {order.full_name}
                    </button>
                  </td>
                  <td>{order.phone}</td>
                  <td>{order.email || '—'}</td>
                  <td>
                    {order.brand} {order.model}
                  </td>
                  <td>
                    <span className={`status-badge ${STATUS_CLASS_BY_VALUE[order.status] || 'status-issued'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <select value={order.status} onChange={(event) => updateStatus(order, event.target.value)}>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-btn" type="button" onClick={() => setSelectedOrder(null)} aria-label="Закрити">
              ×
            </button>
            <h3>Деталі замовлення #{selectedOrder.id}</h3>

            <div className="detail-row">
              <span className="detail-label">Клієнт:</span>
              <span className="detail-value">{selectedOrder.full_name}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Телефон:</span>
              <div className="detail-value">
                <EditableField
                  isEditing={editingField === 'phone'}
                  value={selectedOrder.phone}
                  editValue={editValue}
                  onEdit={() => handleEditClick('phone', selectedOrder.phone)}
                  onChange={setEditValue}
                  onSave={() => updateClientField(selectedOrder.client_id, 'phone', editValue)}
                  onCancel={() => setEditingField(null)}
                />
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Email:</span>
              <div className="detail-value">
                <EditableField
                  isEditing={editingField === 'email'}
                  type="email"
                  value={selectedOrder.email}
                  editValue={editValue}
                  onEdit={() => handleEditClick('email', selectedOrder.email)}
                  onChange={setEditValue}
                  onSave={() => updateClientField(selectedOrder.client_id, 'email', editValue)}
                  onCancel={() => setEditingField(null)}
                />
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Пристрій:</span>
              <span className="detail-value">
                {selectedOrder.brand} {selectedOrder.model}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Тип:</span>
              <span className="detail-value">{selectedOrder.device_type}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Статус:</span>
              <span className="detail-value">
                <span className={`status-badge ${STATUS_CLASS_BY_VALUE[selectedOrder.status] || 'status-issued'}`}>
                  {selectedOrder.status}
                </span>
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Дата:</span>
              <span className="detail-value">{new Date(selectedOrder.created_at).toLocaleString('uk-UA')}</span>
            </div>

            <div className="detail-row description">
              <span className="detail-label">Суть звернення:</span>
              <div className="detail-value description-text">{selectedOrder.issue_description || 'Не вказано'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
