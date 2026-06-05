import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../utils/api';
import '../styles/SharedDark.css';
import '../styles/NewOrderForm.css';

const INITIAL_FORM = {
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  deviceType: 'smartphone',
  brand: '',
  model: '',
  issueDescription: '',
};

export default function NewOrderForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [message, setMessage] = useState('');

  const handleChange = (event) => {
    setForm((currentForm) => ({ ...currentForm, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await axios.post(`${API_URL}/api/orders`, form);
      setMessage(`Замовлення #${response.data.id} створено`);
      setForm(INITIAL_FORM);
      window.dispatchEvent(new Event('orders-summary-refresh'));
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Не вдалося створити замовлення:', error);
      setMessage('Помилка створення замовлення');
    }
  };

  return (
    <div className="new-order-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Нове замовлення</h2>
          <p>Заповніть форму для реєстрації ремонту</p>
        </div>

        {message && <div className="form-message">{message}</div>}

        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="clientName">ПІБ клієнта *</label>
              <input id="clientName" name="clientName" value={form.clientName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="clientPhone">Телефон *</label>
              <input id="clientPhone" name="clientPhone" value={form.clientPhone} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="clientEmail">Email</label>
              <input
                id="clientEmail"
                type="email"
                name="clientEmail"
                value={form.clientEmail}
                onChange={handleChange}
                placeholder="client@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="deviceType">Тип пристрою</label>
              <select id="deviceType" name="deviceType" value={form.deviceType} onChange={handleChange}>
                <option value="smartphone">Смартфон</option>
                <option value="laptop">Ноутбук</option>
                <option value="tablet">Планшет</option>
                <option value="tv">Телевізор</option>
                <option value="other">Інше</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="brand">Бренд</label>
              <input id="brand" name="brand" value={form.brand} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="model">Модель</label>
              <input id="model" name="model" value={form.model} onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="issueDescription">Опис проблеми</label>
              <textarea
                id="issueDescription"
                name="issueDescription"
                rows="3"
                value={form.issueDescription}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Створити замовлення
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
