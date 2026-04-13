import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PartsInventory.css';

export default function PartsInventory() {
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPart, setNewPart] = useState({ part_name: '', quantity: 0, price: 0 });

    useEffect(() => {
        fetchParts();
    }, []);

    const fetchParts = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/parts');
            setParts(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Помилка завантаження деталей:', error);
            setLoading(false);
        }
    };

    const addPart = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/parts', newPart);
            fetchParts();
            setNewPart({ part_name: '', quantity: 0, price: 0 });
            alert('Деталь додано!');
        } catch (error) {
            console.error('Помилка додавання:', error);
            alert('Помилка при додаванні деталі');
        }
    };

    if (loading) {
        return <div className="loading">Завантаження...</div>;
    }

    return (
        <div className="parts-container">
            <h2>🔩 Склад запчастин</h2>
            
            <div className="add-part-form">
                <h3>➕ Додати нову деталь</h3>
                <form onSubmit={addPart}>
                    <input
                        type="text"
                        placeholder="Назва деталі"
                        value={newPart.part_name}
                        onChange={(e) => setNewPart({...newPart, part_name: e.target.value})}
                        required
                    />
                    <input
                        type="number"
                        placeholder="Кількість"
                        value={newPart.quantity}
                        onChange={(e) => setNewPart({...newPart, quantity: parseInt(e.target.value)})}
                        required
                    />
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Ціна"
                        value={newPart.price}
                        onChange={(e) => setNewPart({...newPart, price: parseFloat(e.target.value)})}
                        required
                    />
                    <button type="submit">Додати</button>
                </form>
            </div>

            <table className="parts-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Назва деталі</th>
                        <th>Кількість</th>
                        <th>Ціна (грн)</th>
                    </tr>
                </thead>
                <tbody>
                    {parts.map(part => (
                        <tr key={part.id}>
                            <td>{part.id}</td>
                            <td>{part.part_name}</td>
                            <td className={part.quantity < 5 ? 'low-stock' : ''}>{part.quantity}</td>
                            <td>{part.price} ₴</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}