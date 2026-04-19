import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SharedStyles.css';

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

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

  const updateStatus = async (orderId, newStatus, phone, clientName) => {
    try {
      await axios.put(`http://localhost:5000/api/orders/${orderId}/status`, { status: newStatus });
      
      try {
        await axios.post('http://localhost:5000/api/send-status-sms', {
          phone, orderId, status: newStatus, clientName
        });
      } catch (smsError) {}
      
      fetchOrders();
    } catch (error) {
      alert('Помилка оновлення статусу');
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.phone?.includes(searchTerm) ||
                          order.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Завантаження замовлень...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Місце для фото банеру */}
      <div className="hero-photo-slot">
        <div className="photo-placeholder large">
          <span> Тут буде фото банеру (наприклад, робоча майстерня)</span>
        </div>
      </div>

      <div className="page-header">
        <h2> Список замовлень</h2>
        <p>Всього замовлень: {orders.length}</p>
      </div>

      {/* Фільтри */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Пошук за ім'ям, телефоном або моделлю..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="status-filter">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Всі статуси</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Таблиця */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Клієнт</th>
              <th>Телефон</th>
              <th>Пристрій</th>
              <th>Статус</th>
              <th>Дії</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.full_name}</td>
                <td>{order.phone}</td>
                <td>
                  <span className="device-badge">{order.device_type}</span>
                  <strong>{order.brand}</strong> {order.model}
                </td>
                <td>
                  <span className="status-badge" style={{ background: getStatusColor(order.status) }}>
                    {order.status}
                  </span>
                </td>
                <td>
                  <select 
                    className="status-select"
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value, order.phone, order.full_name)}
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}