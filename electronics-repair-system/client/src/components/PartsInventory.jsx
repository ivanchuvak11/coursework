import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Send, Trash2 } from 'lucide-react';
import { isAdminRole, isManagerRole, isMasterRole } from '../utils/accessControl';
import { API_URL } from '../utils/api';
import '../styles/SharedDark.css';
import '../styles/SectionPages.css';
import '../styles/PartsInventory.css';

const INITIAL_PART = {
  part_name: '',
  quantity: '',
  price: '',
  category: '',
};
const INITIAL_PART_REQUEST = { partName: '', quantity: 1, comment: '' };

function getPartSortValue(part, field) {
  if (['id', 'quantity', 'price'].includes(field)) return Number(part[field]);
  return String(part[field] || '').toLowerCase();
}

export default function PartsInventory({ user }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPart, setNewPart] = useState(INITIAL_PART);
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [search, setSearch] = useState('');
  const [requestPart, setRequestPart] = useState(null);
  const [partRequest, setPartRequest] = useState(INITIAL_PART_REQUEST);
  const [requestSaving, setRequestSaving] = useState(false);
  const canEditInventory = isAdminRole(user) || isManagerRole(user);
  const canDeletePart = isAdminRole(user);
  const canRequestPart = isMasterRole(user);

  const fetchParts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/parts`);
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

  useEffect(() => {
    if (!canEditInventory) return undefined;

    const handleOpenAddPart = (event) => {
      const request = event.detail || {};
      setNewPart({
        part_name: request.partName || '',
        quantity: request.quantity ? String(request.quantity) : '',
        price: '',
        category: request.category || '',
      });
      setShowForm(true);
      window.setTimeout(() => {
        document.querySelector('.inventory-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    };

    window.addEventListener('inventory-open-add-part', handleOpenAddPart);
    return () => window.removeEventListener('inventory-open-add-part', handleOpenAddPart);
  }, [canEditInventory]);

  const handlePartChange = (field, value) => {
    setNewPart((part) => ({ ...part, [field]: value }));
  };

  const addPart = async (event) => {
    event.preventDefault();
    if (!canEditInventory) return;

    try {
      await axios.post(`${API_URL}/api/parts`, newPart);
      setNewPart(INITIAL_PART);
      setShowForm(false);
      fetchParts();
    } catch (error) {
      console.error('Не вдалося додати деталь:', error);
      alert('Помилка додавання деталі');
    }
  };

  const updateQuantity = async (id, currentQuantity, delta) => {
    if (!canEditInventory) return;

    const quantity = Number(currentQuantity || 0) + delta;

    if (quantity < 0) {
      alert('Кількість не може бути від’ємною');
      return;
    }

    try {
      setUpdatingId(id);
      await axios.put(`${API_URL}/api/parts/${id}`, { quantity });
      setParts((currentParts) => currentParts.map((part) => (part.id === id ? { ...part, quantity } : part)));
    } catch (error) {
      console.error('Не вдалося оновити кількість:', error);
      alert('Помилка оновлення кількості');
    } finally {
      setUpdatingId(null);
    }
  };

  const deletePart = async (part) => {
    if (!canDeletePart) return;

    if (!confirm(`Видалити деталь "${part.part_name}" зі складу?`)) return;

    try {
      setDeletingId(part.id);
      await axios.delete(`${API_URL}/api/parts/${part.id}`);
      setParts((currentParts) => currentParts.filter((item) => item.id !== part.id));
    } catch (error) {
      console.error('Не вдалося видалити деталь:', error);
      alert(error.response?.data?.error || 'Помилка видалення деталі');
    } finally {
      setDeletingId(null);
    }
  };

  const openPartRequest = (part) => {
    setRequestPart(part);
    setPartRequest(INITIAL_PART_REQUEST);
  };

  const openCustomPartRequest = () => {
    setRequestPart({ id: null, part_name: '', quantity: null, isCustom: true });
    setPartRequest(INITIAL_PART_REQUEST);
  };

  const closePartRequest = () => {
    setRequestPart(null);
    setPartRequest(INITIAL_PART_REQUEST);
  };

  const submitPartRequest = async (event) => {
    event.preventDefault();
    if (!requestPart || !canRequestPart) return;

    try {
      setRequestSaving(true);
      await axios.post(`${API_URL}/api/part-requests`, {
        partId: requestPart.id || null,
        partName: requestPart.isCustom ? partRequest.partName : undefined,
        quantity: Number(partRequest.quantity),
        comment: partRequest.comment,
      });
      window.dispatchEvent(new Event('part-requests-refresh'));
      closePartRequest();
      alert('Заявку на замовлення деталі надіслано адміністратору.');
    } catch (error) {
      console.error('Не вдалося створити заявку на деталі:', error);
      alert(error.response?.data?.error || 'Помилка створення заявки на деталі');
    } finally {
      setRequestSaving(false);
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

  const sortedParts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredParts = parts.filter((part) => {
      if (!normalizedSearch) return true;

      return [
        part.id,
        part.part_name,
        part.category,
        part.supplier,
        part.quantity,
        part.price,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });

    return filteredParts.sort((a, b) => {
        const aValue = getPartSortValue(a, sortField);
        const bValue = getPartSortValue(b, sortField);

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [parts, search, sortField, sortOrder]);

  if (loading) return <div className="loading">Завантаження...</div>;

  return (
    <div className="section-page parts-page">
      <div className="section-header">
        <div>
          <h1>Склад запчастин</h1>
          <p>Облік деталей, залишків та закупівельної вартості для ремонту.</p>
        </div>
        <strong className="parts-count">Всього найменувань: {parts.length}</strong>
      </div>

      <div className="section-card parts-card">
        <div className="section-tools parts-tools">
          <label className="parts-search" aria-label="Пошук деталей">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук за назвою, категорією, ціною..."
            />
          </label>
          {canEditInventory ? (
            <button className="btn-primary inventory-toggle" type="button" onClick={() => setShowForm((isOpen) => !isOpen)}>
              + Додати деталь
            </button>
          ) : (
            <>
              <p className="readonly-note">Режим перегляду: майстер бачить залишки та ціни, а за потреби може надіслати заявку на замовлення деталі.</p>
              {canRequestPart && (
                <button className="btn-primary inventory-toggle" type="button" onClick={openCustomPartRequest}>
                  + Запросити іншу деталь
                </button>
              )}
            </>
          )}
        </div>

        {showForm && canEditInventory && (
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
                {canRequestPart && <th className="actions-column">Запит</th>}
                {canDeletePart && <th className="actions-column">Дії</th>}
              </tr>
            </thead>
            <tbody>
              {sortedParts.map((part) => (
                <tr key={part.id}>
                  <td>{part.id}</td>
                  <td>{part.part_name}</td>
                  <td>{part.category || '—'}</td>
                  <td>
                    {canEditInventory ? (
                      <div className="quantity-control">
                        <button type="button" onClick={() => updateQuantity(part.id, part.quantity, -1)} disabled={updatingId === part.id}>
                          −
                        </button>
                        <span className={part.quantity < 5 ? 'low-stock' : ''}>{part.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(part.id, part.quantity, 1)} disabled={updatingId === part.id}>
                          +
                        </button>
                      </div>
                    ) : (
                      <span className={`quantity-readonly ${part.quantity < 5 ? 'low-stock' : ''}`}>{part.quantity}</span>
                    )}
                  </td>
                  <td>{Number(part.price || 0).toLocaleString('uk-UA')} ₴</td>
                  {canRequestPart && (
                    <td>
                      <button
                        className="request-part-button"
                        type="button"
                        onClick={() => openPartRequest(part)}
                        aria-label={`Запросити замовлення ${part.part_name}`}
                        title="Запросити замовлення"
                      >
                        <Send size={16} strokeWidth={1.9} />
                      </button>
                    </td>
                  )}
                  {canDeletePart && (
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
                  )}
                </tr>
              ))}
              {sortedParts.length === 0 && (
                <tr>
                  <td className="parts-empty" colSpan={5 + (canRequestPart ? 1 : 0) + (canDeletePart ? 1 : 0)}>
                    Деталі за таким пошуком не знайдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {requestPart && (
        <div className="part-request-overlay" onClick={closePartRequest}>
          <form className="part-request-modal" onSubmit={submitPartRequest} onClick={(event) => event.stopPropagation()}>
            <div className="part-request-header">
              <div>
                <span>Заявка на замовлення</span>
                <h2>{requestPart.isCustom ? 'Інша деталь' : requestPart.part_name}</h2>
              </div>
              <button type="button" onClick={closePartRequest} aria-label="Закрити">×</button>
            </div>

            {requestPart.isCustom ? (
              <label className="part-request-field">
                Назва потрібної деталі
                <input
                  type="text"
                  value={partRequest.partName}
                  onChange={(event) => setPartRequest((request) => ({ ...request, partName: event.target.value }))}
                  placeholder="Наприклад, шлейф кнопки живлення Xiaomi"
                  required
                />
              </label>
            ) : (
              <div className="part-request-stock">
                <span>Поточний залишок</span>
                <strong className={requestPart.quantity < 5 ? 'low-stock' : ''}>{requestPart.quantity} шт.</strong>
              </div>
            )}

            <label className="part-request-field">
              Кількість для замовлення
              <input
                type="number"
                min="1"
                value={partRequest.quantity}
                onChange={(event) => setPartRequest((request) => ({ ...request, quantity: event.target.value }))}
                required
              />
            </label>

            <label className="part-request-field">
              Коментар для адміністратора
              <textarea
                rows="3"
                value={partRequest.comment}
                onChange={(event) => setPartRequest((request) => ({ ...request, comment: event.target.value }))}
                placeholder="Наприклад, потрібна для ремонту Samsung або залишок майже закінчився"
              />
            </label>

            <div className="part-request-actions">
              <button type="button" onClick={closePartRequest}>Скасувати</button>
              <button className="btn-primary" type="submit" disabled={requestSaving}>
                {requestSaving ? 'Надсилання...' : 'Надіслати заявку'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
