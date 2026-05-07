import React, { useState } from 'react';
import axios from 'axios';
import './SharedDark.css';

export default function NewOrderForm() {
  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',      // ДОДАНО
    deviceType: 'smartphone',
    brand: '',
    model: '',
    issueDescription: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/orders', {
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        clientEmail: form.clientEmail,  // ДОДАНО
        deviceType: form.deviceType,
        brand: form.brand,
        model: form.model,
        issueDescription: form.issueDescription
      });
      setMessage(`✅ Замовлення #${res.data.id} створено!`);
      setForm({
        clientName: '',
        clientPhone: '',
        clientEmail: '',  // ДОДАНО
        deviceType: 'smartphone',
        brand: '',
        model: '',
        issueDescription: ''
      });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('❌ Помилка створення');
      console.error(err);
    }
  };

  return (
    <div className="parts-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Нове замовлення</h2>
          <p>Заповніть форму для реєстрації ремонту</p>
        </div>

        {message && (
          <div style={{ background: '#4c5c96', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-grid">
            <div className="form-group">
              <label>ПІБ клієнта *</label>
              <input name="clientName" value={form.clientName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Телефон *</label>
              <input name="clientPhone" value={form.clientPhone} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                name="clientEmail" 
                value={form.clientEmail} 
                onChange={handleChange} 
                placeholder="client@example.com"
              />
            </div>
            <div className="form-group">
              <label>Тип пристрою</label>
              <select name="deviceType" value={form.deviceType} onChange={handleChange}>
                <option value="smartphone">Смартфон</option>
                <option value="laptop">Ноутбук</option>
                <option value="tablet">Планшет</option>
                <option value="tv">Телевізор</option>
                <option value="other">Інше</option>
              </select>
            </div>
            <div className="form-group">
              <label>Бренд</label>
              <input name="brand" value={form.brand} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Модель</label>
              <input name="model" value={form.model} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Опис проблеми</label>
              <textarea name="issueDescription" rows="3" value={form.issueDescription} onChange={handleChange}></textarea>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button type="submit" className="btn-primary">Створити замовлення</button>
          </div>
        </form>
      </div>

      <style>{`
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.2rem;
        }
        .form-group label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 0.4rem;
          color: rgba(255,255,255,0.8);
        }
        .form-group input, .form-group select, .form-group textarea {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          padding: 8px 12px;
          color: white;
        }
      `}</style>
    </div>
  );
}

