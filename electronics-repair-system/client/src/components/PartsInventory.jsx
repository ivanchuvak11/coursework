import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SharedDark.css';

export default function PartsInventory() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPart, setNewPart] = useState({ part_name: '', quantity: '', price: '' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchParts(); }, []);

  const fetchParts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/parts');
      setParts(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/parts', newPart);
      fetchParts();
      setNewPart({ part_name: '', quantity: '', price: '' });
      setShowForm(false);
    } catch (err) { alert('Помилка додавання'); }
  };

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="parts-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Склад запчастин</h2>
          <p>Всього найменувань: {parts.length}</p>
        </div>

        <button className="btn-primary" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(!showForm)}>+ Додати деталь</button>

        {showForm && (
          <form onSubmit={addPart} className="form-card" style={{ marginBottom: '2rem' }}>
            <div className="form-grid">
              <input placeholder="Назва деталі" value={newPart.part_name} onChange={(e) => setNewPart({...newPart, part_name: e.target.value})} required />
              <input placeholder="Кількість" type="number" value={newPart.quantity} onChange={(e) => setNewPart({...newPart, quantity: e.target.value})} required />
              <input placeholder="Ціна (грн)" type="number" step="0.01" value={newPart.price} onChange={(e) => setNewPart({...newPart, price: e.target.value})} required />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Зберегти</button>
          </form>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>ID</th><th>Назва</th><th>Кількість</th><th>Ціна (грн)</th></tr></thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td><td>{p.part_name}</td><td>{p.quantity}</td><td>{p.price} ₴</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}