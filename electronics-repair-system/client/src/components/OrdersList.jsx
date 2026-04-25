import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SharedDark.css';

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const statuses = ['прийнято', 'діагностика', 'ремонт', 'виконано', 'видано'];

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/orders');
      setOrders(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id, newStatus, phone, clientName) => {
    try {
      await axios.put(`http://localhost:5000/api/orders/${id}/status`, { status: newStatus });
      await axios.post('http://localhost:5000/api/send-status-sms', { phone, orderId: id, status: newStatus, clientName });
      fetchOrders();
    } catch (error) { alert('Помилка'); }
  };

  const getStatusColor = (status) => ({
    'прийнято': '#f59e0b', 'діагностика': '#8b5cf6', 'ремонт': '#3b82f6', 'виконано': '#10b981', 'видано': '#6b7280'
  }[status]);

  const filtered = orders.filter(o =>
    (o.full_name?.toLowerCase().includes(search.toLowerCase()) || o.phone?.includes(search)) &&
    (filterStatus === 'all' || o.status === filterStatus)
  );

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="dark-page">
      <div className="page-header">
        <h2>Список замовлень</h2>
        <p>Всього: {orders.length}</p>
      </div>

      <div className="filters-row">
        <input type="text" placeholder="Пошук за ім'ям або телефоном" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Всі статуси</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Клієнт</th><th>Телефон</th><th>Пристрій</th><th>Статус</th><th>Дія</th></tr>
          </thead>
          <tbody>
            {filtered.map(order => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.full_name}</td>
                <td>{order.phone}</td>
                <td>{order.brand} {order.model}</td>
                <td><span className="status-badge" style={{ backgroundColor: getStatusColor(order.status) }}>{order.status}</span></td>
                <td>
                  <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value, order.phone, order.full_name)}>
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