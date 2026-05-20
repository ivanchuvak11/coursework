import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import '../styles/SharedDark.css';
import '../styles/PartsInventory.css';

const API_URL = 'http://localhost:5000/api';

const INITIAL_PART = {
  part_name: '',
  quantity: '',
  price: '',
  category: '',
};

function getPartSortValue(part, field) {
  if (['id', 'quantity', 'price'].includes(field)) return Number(part[field]);
  return String(part[field] || '').toLowerCase();
}

export default function PartsInventory() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPart, setNewPart] = useState(INITIAL_PART);
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');

  const fetchParts = async () => {
    try {
      const response = await axios.get(`${API_URL}/parts`);
      setParts(response.data);
    } catch (error) {
      console.error('Не вдалося завантажити склад:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const handlePartChange = (field, value) => {
    setNewPart((part) => ({ ...part, [field]: value }));
  };

  const addPart = async (event) => {
    event.preventDefault();

    try {
      await axios.post(`${API_URL}/parts`, newPart);
      setNewPart(INITIAL_PART);
      setShowForm(false);
      fetchParts();
    } catch (error) {
      console.error('Не вдалося додати деталь:', error);
      alert('Помилка додавання деталі');
    }
  };

  const updateQuantity = async (id, currentQuantity, delta) => {
    const quantity = Number(currentQuantity || 0) + delta;

    if (quantity < 0) {
      alert('Кількість не може бути від’ємною');
      return;
    }

    try {
      setUpdatingId(id);
      await axios.put(`${API_URL}/parts/${id}`, { quantity });
      setParts((currentParts) => currentParts.map((part) => (part.id === id ? { ...part, quantity } : part)));
    } catch (error) {
      console.error('Не вдалося оновити кількість:', error);
      alert('Помилка оновлення кількості');
    } finally {
      setUpdatingId(null);
    }
  };

  const deletePart = async (part) => {
    if (!confirm(`Видалити деталь "${part.part_name}" зі складу?`)) return;

    try {
      setDeletingId(part.id);
      await axios.delete(`${API_URL}/parts/${part.id}`);
      setParts((currentParts) => currentParts.filter((item) => item.id !== part.id));
    } catch (error) {
      console.error('Не вдалося видалити деталь:', error);
      alert(error.response?.data?.error || 'Помилка видалення деталі');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortOrder('asc');
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const sortedParts = useMemo(
    () =>
      [...parts].sort((a, b) => {
        const aValue = getPartSortValue(a, sortField);
        const bValue = getPartSortValue(b, sortField);

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }),
    [parts, sortField, sortOrder],
  );

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="parts-page">
      <div className="glass-container">
        <div className="page-header">
          <h2>Склад запчастин</h2>
          <p>Всього найменувань: {parts.length}</p>
        </div>

        <button className="btn-primary inventory-toggle" type="button" onClick={() => setShowForm((isOpen) => !isOpen)}>
          + Додати деталь
        </button>

        {showForm && (
          <form onSubmit={addPart} className="form-card inventory-form">
            <div className="inventory-form-grid">
              <input
                className="inventory-name-input"
                type="text"
                placeholder="Назва"
                value={newPart.part_name}
                onChange={(event) => handlePartChange('part_name', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Категорія"
                value={newPart.category}
                onChange={(event) => handlePartChange('category', event.target.value)}
              />
              <input
                type="number"
                placeholder="Кількість"
                value={newPart.quantity}
                onChange={(event) => handlePartChange('quantity', event.target.value)}
                required
              />
              <input
                type="number"
                step="0.01"
                placeholder="Ціна"
                value={newPart.price}
                onChange={(event) => handlePartChange('price', event.target.value)}
                required
              />
              <button type="submit" className="btn-primary">
                Додати
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Скасувати
              </button>
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
                <th className="actions-column">Дії</th>
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((part) => (
                <tr key={part.id}>
                  <td>{part.id}</td>
                  <td>{part.part_name}</td>
                  <td>{part.category || '—'}</td>
                  <td>
                    <div className="quantity-control">
                      <button type="button" onClick={() => updateQuantity(part.id, part.quantity, -1)} disabled={updatingId === part.id}>
                        −
                      </button>
                      <span className={part.quantity < 5 ? 'low-stock' : ''}>{part.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(part.id, part.quantity, 1)} disabled={updatingId === part.id}>
                        +
                      </button>
                    </div>
                  </td>
                  <td>{Number(part.price || 0).toLocaleString('uk-UA')} ₴</td>
                  <td>
                    <button
                      className="delete-part-button"
                      type="button"
                      onClick={() => deletePart(part)}
                      disabled={deletingId === part.id}
                      aria-label={`Видалити ${part.part_name}`}
                      title="Видалити"
                    >
                      <Trash2 size={17} strokeWidth={1.9} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
