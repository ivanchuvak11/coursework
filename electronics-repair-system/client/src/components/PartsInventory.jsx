import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SharedDark.css';

export default function PartsInventory() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPart, setNewPart] = useState({ part_name: '', quantity: '', price: '', category: '' });
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => { fetchParts(); }, []);

  const fetchParts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/parts');
      setParts(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const addPart = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/parts', newPart);
      fetchParts();
      setNewPart({ part_name: '', quantity: '', price: '', category: '' });
      setShowForm(false);
    } catch (error) { alert('Помилка додавання'); }
  };

  const updateQuantity = async (id, currentQuantity, delta) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity < 0) {
      alert('Кількість не може бути від\'ємною');
      return;
    }
    
    try {
      setUpdatingId(id);
      await axios.put(`http://localhost:5000/api/parts/${id}`, { quantity: newQuantity });
      fetchParts();
    } catch (error) {
      alert('Помилка оновлення кількості');
    } finally {
      setUpdatingId(null);
    }
  };

  // Сортування
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

  // Сортування даних
  const sortedParts = [...parts].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (sortField === 'id' || sortField === 'quantity' || sortField === 'price') {
      aVal = Number(aVal);
      bVal = Number(bVal);
    } else if (sortField === 'part_name' || sortField === 'category') {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    }
    
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="parts-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Склад запчастин</h2>
          <p>Всього найменувань: {parts.length}</p>
        </div>

        <button 
          className="btn-primary" 
          style={{ marginBottom: '1rem' }}
          onClick={() => setShowForm(!showForm)}
        >
          + Додати деталь
        </button>

        {showForm && (
          <form onSubmit={addPart} className="form-card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Назва" value={newPart.part_name} onChange={(e) => setNewPart({...newPart, part_name: e.target.value})} required style={{ flex: 2 }} />
              <input type="text" placeholder="Категорія" value={newPart.category} onChange={(e) => setNewPart({...newPart, category: e.target.value})} style={{ flex: 1 }} />
              <input type="number" placeholder="Кількість" value={newPart.quantity} onChange={(e) => setNewPart({...newPart, quantity: e.target.value})} required style={{ flex: 1 }} />
              <input type="number" step="0.01" placeholder="Ціна" value={newPart.price} onChange={(e) => setNewPart({...newPart, price: e.target.value})} required style={{ flex: 1 }} />
              <button type="submit" className="btn-primary">Додати</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Скасувати</button>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table className="parts-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')}>ID {getSortIcon('id')}</th>
                <th onClick={() => handleSort('part_name')}>Назва {getSortIcon('part_name')}</th>
                <th onClick={() => handleSort('category')}>Категорія {getSortIcon('category')}</th>
                <th onClick={() => handleSort('quantity')}>Кількість {getSortIcon('quantity')}</th>
                <th onClick={() => handleSort('price')}>Ціна (грн) {getSortIcon('price')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.part_name}</td>
                  <td>{p.category || '—'}</td>
                  <td>
                    <div className="quantity-control">
                      <button onClick={() => updateQuantity(p.id, p.quantity, -1)} disabled={updatingId === p.id}>−</button>
                      <span className={p.quantity < 5 ? 'low-stock' : ''}>{p.quantity}</span>
                      <button onClick={() => updateQuantity(p.id, p.quantity, 1)} disabled={updatingId === p.id}>+</button>
                    </div>
                  </td>
                  <td>{p.price.toLocaleString('uk-UA')} ₴</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .btn-secondary {
          background: #4b5563;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          color: white;
          cursor: pointer;
        }
        .parts-table {
          width: 100%;
          border-collapse: collapse;
        }
        .parts-table th {
          text-align: left;
          padding: 12px 8px;
          background: rgba(0, 0, 0, 0.3);
          font-weight: 600;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          cursor: pointer;
        }
        .parts-table th:hover {
          background: rgba(255,255,255,0.05);
        }
        .parts-table td {
          text-align: left;
          padding: 12px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .quantity-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .quantity-control button {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: #334155;
          color: white;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
        }
        .quantity-control button:hover {
          background: #475569;
        }
        .quantity-control button:disabled {
          opacity: 0.5;
        }
        .quantity-control span {
          min-width: 40px;
          text-align: center;
          font-weight: 500;
        }
        .low-stock {
          color: #f97316;
        }
        input, select {
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