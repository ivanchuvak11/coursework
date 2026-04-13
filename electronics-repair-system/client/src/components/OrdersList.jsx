import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './OrdersList.css';

const statuses = ['прийнято', 'діагностика', 'ремонт', 'виконано', 'видано'];

export default function OrdersList() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/orders');
            setOrders(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Помилка завантаження:', error);
            setLoading(false);
        }
    };

    const updateStatus = async (orderId, newStatus, phone, clientName) => {
        try {
            await axios.put(`http://localhost:5000/api/orders/${orderId}/status`, { status: newStatus });
            
            // SMS сповіщення (якщо сервер підтримує)
            try {
                await axios.post('http://localhost:5000/api/send-status-sms', {
                    phone,
                    orderId,
                    status: newStatus,
                    clientName
                });
                alert(`Сповіщення надіслано на ${phone}`);
            } catch (smsError) {
                console.log('SMS не надіслано (сервер не налаштовано)');
            }
            
            fetchOrders(); // Оновлюємо список
        } catch (error) {
            console.error('Помилка оновлення статусу:', error);
            alert('Помилка при оновленні статусу');
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'прийнято': '#gray',
            'діагностика': '#ff9800',
            'ремонт': '#2196f3',
            'виконано': '#4caf50',
            'видано': '#2e7d32'
        };
        return colors[status] || '#000';
    };

    const getStatusBackground = (status) => {
        const backgrounds = {
            'прийнято': '#f0f0f0',
            'діагностика': '#fff3e0',
            'ремонт': '#e3f2fd',
            'виконано': '#e8f5e9',
            'видано': '#e8f5e9'
        };
        return backgrounds[status] || '#fff';
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="orders-container">
            <h2>📋 Список замовлень</h2>
            {orders.length === 0 ? (
                <p>Немає замовлень. Створіть перше!</p>
            ) : (
                <table className="orders-table">
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
                        {orders.map(order => (
                            <tr key={order.id}>
                                <td>#{order.id}</td>
                                <td>{order.full_name}</td>
                                <td>{order.phone}</td>
                                <td>{order.brand} {order.model} ({order.device_type})</td>
                                <td style={{ 
                                    color: getStatusColor(order.status), 
                                    fontWeight: 'bold',
                                    backgroundColor: getStatusBackground(order.status),
                                    padding: '5px 10px',
                                    borderRadius: '5px'
                                }}>
                                    {order.status}
                                </td>
                                <td>
                                    <select 
                                        value={order.status}
                                        onChange={(e) => updateStatus(order.id, e.target.value, order.phone, order.full_name)}
                                        className="status-select"
                                    >
                                        {statuses.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}