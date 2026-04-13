import React, { useState } from 'react';
import axios from 'axios';
import './NewOrderForm.css';

export default function NewOrderForm() {
    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        deviceType: 'smartphone',
        brand: '',
        model: '',
        issueDescription: ''
    });

    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/orders', formData);
            setMessage(`✅ Замовлення #${response.data.id} успішно створено!`);
            setFormData({
                clientName: '',
                clientPhone: '',
                deviceType: 'smartphone',
                brand: '',
                model: '',
                issueDescription: ''
            });
        } catch (error) {
            setMessage('❌ Помилка при створенні замовлення');
            console.error(error);
        }
    };

    return (
        <div className="new-order-container">
            <h2>➕ Нове замовлення на ремонт</h2>
            {message && <div className="message">{message}</div>}
            <form onSubmit={handleSubmit} className="order-form">
                <div className="form-group">
                    <label>ПІБ клієнта *</label>
                    <input
                        type="text"
                        name="clientName"
                        value={formData.clientName}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Телефон клієнта *</label>
                    <input
                        type="tel"
                        name="clientPhone"
                        value={formData.clientPhone}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Тип пристрою</label>
                    <select name="deviceType" value={formData.deviceType} onChange={handleChange}>
                        <option value="smartphone">Смартфон</option>
                        <option value="laptop">Ноутбук</option>
                        <option value="tablet">Планшет</option>
                        <option value="tv">Телевізор</option>
                        <option value="other">Інше</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Бренд</label>
                    <input
                        type="text"
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label>Модель</label>
                    <input
                        type="text"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label>Опис проблеми</label>
                    <textarea
                        name="issueDescription"
                        value={formData.issueDescription}
                        onChange={handleChange}
                        rows="4"
                    />
                </div>

                <button type="submit" className="submit-btn">Створити замовлення</button>
            </form>
        </div>
    );
}