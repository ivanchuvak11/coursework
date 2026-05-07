import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SharedDark.css';

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

  const statuses = ['прийнято', 'діагностика', 'ремонт', 'виконано', 'видано'];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders');
      setOrders(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Помилка:', error);
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus, phone, clientName, clientEmail) => {
    try {
      await axios.put(`http://localhost:5000/api/orders/${id}/status`, { status: newStatus });
      try {
        await axios.post('http://localhost:5000/api/send-status-sms', {
          phone,
          orderId: id,
          status: newStatus,
          clientName,
          clientEmail,
        });
      } catch (smsError) {
        console.log('SMS не відправлено');
      }
      fetchOrders();
    } catch (error) {
      alert('Помилка оновлення статусу');
    }
  };

  // Функція оновлення даних клієнта
  const updateClientField = async (clientId, field, value) => {
    try {
      await axios.put(`http://localhost:5000/api/clients/${clientId}`, {
        [field]: value
      });
      setEditingField(null);
      setEditValue('');
      fetchOrders();
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, [field]: value });
      }
    } catch (error) {
      console.error('Помилка оновлення:', error);
      alert('Помилка оновлення даних');
    }
  };

  const handleEditClick = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const getStatusColor = (status) => {
    const colors = {
      'прийнято': '#f59e0b',
      'діагностика': '#8b5cf6',
      'ремонт': '#3b82f6',
      'виконано': '#10b981',
      'видано': '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return ' ';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const filteredOrders = orders.filter(order => {
    const matchSearch = (order.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
                        (order.phone || '').includes(search);
    const matchStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (sortField === 'id') {
      aVal = Number(aVal);
      bVal = Number(bVal);
    } else if (sortField === 'full_name' || sortField === 'phone' || sortField === 'email') {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    } else if (sortField === 'device') {
      aVal = `${a.brand || ''} ${a.model || ''}`.toLowerCase();
      bVal = `${b.brand || ''} ${b.model || ''}`.toLowerCase();
    } else if (sortField === 'status') {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

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
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Всі статуси</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
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
                    <span
                      className="client-name"
                      onClick={() => setSelectedOrder(order)}
                    >
                      {order.full_name}
                    </span>
                  </td>
                  <td>{order.phone}</td>
                  <td>{order.email || '—'}</td>
                  <td>{order.brand} {order.model}</td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.status) }}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value, order.phone, order.full_name, order.email)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальне вікно з редагуванням */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedOrder(null)}>✕</button>
            <h3>Деталі замовлення #{selectedOrder.id}</h3>
            
            <div className="detail-row">
              <span className="detail-label">Клієнт:</span>
              <span className="detail-value">{selectedOrder.full_name}</span>
            </div>
            
            {/* Редагування телефону */}
            <div className="detail-row">
              <span className="detail-label">Телефон:</span>
              <div className="detail-value">
                {editingField === 'phone' ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '6px 10px', color: 'white', flex: 1 }}
                      autoFocus
                    />
                    <button onClick={() => updateClientField(selectedOrder.client_id, 'phone', editValue)} style={{ background: '#22c55e', border: 'none', borderRadius: '6px', padding: '4px 12px', color: 'white', cursor: 'pointer' }}>💾</button>
                    <button onClick={() => setEditingField(null)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 12px', color: 'white', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{selectedOrder.phone}</span>
                    <button onClick={() => handleEditClick('phone', selectedOrder.phone)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Редагування email */}
            <div className="detail-row">
              <span className="detail-label">Email:</span>
              <div className="detail-value">
                {editingField === 'email' ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="email"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', padding: '6px 10px', color: 'white', flex: 1 }}
                      autoFocus
                    />
                    <button onClick={() => updateClientField(selectedOrder.client_id, 'email', editValue)} style={{ background: '#22c55e', border: 'none', borderRadius: '6px', padding: '4px 12px', color: 'white', cursor: 'pointer' }}>💾</button>
                    <button onClick={() => setEditingField(null)} style={{ background: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 12px', color: 'white', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{selectedOrder.email || '—'}</span>
                    <button onClick={() => handleEditClick('email', selectedOrder.email || '')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Пристрій:</span>
              <span className="detail-value">{selectedOrder.brand} {selectedOrder.model}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Тип:</span>
              <span className="detail-value">{selectedOrder.device_type}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Статус:</span>
              <span className="detail-value">
                <span className="status-badge" style={{ backgroundColor: getStatusColor(selectedOrder.status) }}>
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
              <div className="detail-value description-text">
                {selectedOrder.issue_description || 'Не вказано'}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .orders-table {
          width: 100%;
          border-collapse: collapse;
        }
        .orders-table th {
          text-align: left;
          padding: 12px 8px;
          background: rgba(0, 0, 0, 0.3);
          font-weight: 600;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .orders-table th:hover {
          background: rgba(255,255,255,0.05);
        }
        .orders-table td {
          text-align: left;
          padding: 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .client-name {
          cursor: pointer;
          color: #ffffff;
          text-decoration: underline;
        }
        .client-name:hover {
          color: #b8b8b8;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          color: white;
          font-size: 0.75rem;
          font-weight: 500;
        }
        select {
          background: #334155;
          border: 1px solid #475569;
          border-radius: 6px;
          padding: 6px 10px;
          color: white;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .filters-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .filters-row input {
          flex: 1;
          min-width: 200px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          padding: 8px 12px;
          color: white;
        }
        .filters-row select {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          padding: 8px 12px;
          color: white;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .order-modal {
          background: #1e293b;
          border-radius: 16px;
          padding: 20px;
          width: 450px;
          max-width: 95%;
          position: relative;
          border: 1px solid #334155;
        }
        .modal-close-btn {
          position: absolute;
          top: 10px;
          right: 15px;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 20px;
          cursor: pointer;
        }
        .modal-close-btn:hover {
          color: white;
        }
        .order-modal h3 {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 1px solid #334155;
        }
        .detail-row {
          display: flex;
          margin-bottom: 12px;
          text-align: left;
        }
        .detail-label {
          width: 100px;
          font-weight: 600;
          color: #94a3b8;
          text-align: left;
        }
        .detail-value {
          flex: 1;
          color: #f1f5f9;
          text-align: left;
        }
        .detail-row.description {
          flex-direction: column;
        }
        .detail-row.description .detail-label {
          width: 100%;
          margin-bottom: 8px;
        }
        .description-text {
          background: #0f172a;
          padding: 10px;
          border-radius: 8px;
          line-height: 1.5;
        }
        .loading {
          text-align: center;
          padding: 50px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

const updateClientField = async (clientId, field, value) => {
    console.log('clientId:', clientId);  // Подивіться, що тут
    if (!clientId) {
        alert('Помилка: ID клієнта не знайдено');
        return;
    }
    try {
        await axios.put(`http://localhost:5000/api/clients/${clientId}`, { [field]: value });
        setEditingField(null);
        setEditValue('');
        fetchOrders();
        if (selectedOrder) {
            setSelectedOrder({ ...selectedOrder, [field]: value });
        }
        alert('Дані оновлено!');
    } catch (error) {
        console.error('Помилка:', error);
        alert('Помилка оновлення даних: ' + (error.response?.data?.error || error.message));
    }
};

