import React, { useState } from 'react';
import axios from 'axios';
import './SharedDark.css';

export default function NewOrderForm() {
  const [form, setForm] = useState({
    clientName: '', clientPhone: '', deviceType: 'smartphone', brand: '', model: '', issueDescription: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/orders', form);
      setMessage(`✅ Замовлення #${res.data.id} створено!`);
      setForm({ clientName: '', clientPhone: '', deviceType: 'smartphone', brand: '', model: '', issueDescription: '' });
    } catch (err) {
      setMessage('❌ Помилка створення');
    }
  };

  return (
    <div className="new-order-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Нове замовлення</h2>
          <p>Заповніть форму для реєстрації ремонту</p>
        </div>
        {message && <div className="message">{message}</div>}
        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-grid">
            <div className="form-group"><label>ПІБ клієнта *</label><input name="clientName" value={form.clientName} onChange={handleChange} required /></div>
            <div className="form-group"><label>Телефон *</label><input name="clientPhone" value={form.clientPhone} onChange={handleChange} required /></div>
            <div className="form-group"><label>Тип пристрою</label><select name="deviceType" value={form.deviceType} onChange={handleChange}><option value="smartphone">Смартфон</option><option value="laptop">Ноутбук</option><option value="tablet">Планшет</option><option value="other">Інше</option></select></div>
            <div className="form-group"><label>Бренд</label><input name="brand" value={form.brand} onChange={handleChange} /></div>
            <div className="form-group"><label>Модель</label><input name="model" value={form.model} onChange={handleChange} /></div>
            <div className="form-group"><label>Опис проблеми</label><textarea name="issueDescription" rows="3" value={form.issueDescription} onChange={handleChange}></textarea></div>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}><button type="submit" className="btn-primary">Створити замовлення</button></div>
        </form>
      </div>

      // Додайте це поле у форму
<div className="form-group">
    <label>Email клієнта</label>
    <input 
        type="email" 
        name="clientEmail" 
        value={form.clientEmail} 
        onChange={handleChange} 
        placeholder="ivanvasilchooc235@gmail.com"
    />
</div>
      <style>{`
        .message {
          background: #4c5c96;
          padding: 0.8rem;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}