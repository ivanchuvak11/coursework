import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import OrdersList from './components/OrdersList';
import NewOrderForm from './components/NewOrderForm';
import PartsInventory from './components/PartsInventory';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            checkAuth();
        } else {
            setLoading(false);
        }
    }, []);

    const checkAuth = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/auth/me');
            setUser(response.data);
            setIsAuthenticated(true);
        } catch (error) {
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
    };

    const handleLogout = async () => {
        try {
            await axios.post('http://localhost:5000/api/auth/logout');
        } catch (error) {}
        
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setIsAuthenticated(false);
        setUser(null);
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '50px', color: 'white', background: '#2e3141', height: '100vh' }}>Завантаження...</div>;
    }

    // Якщо не авторизований - показуємо Landing Page з можливістю логіну
    if (!isAuthenticated) {
        return (
            <BrowserRouter>
                <Routes>
                    <Route path="/*" element={
                        <div>
                            <LandingPage />
                            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
                                <a href="/login" className="button primary" style={{ background: '#4c5c96', padding: '15px 30px' }}>🔐 Вхід для персоналу</a>
                            </div>
                        </div>
                    } />
                    <Route path="/login" element={<Login onLogin={handleLogin} />} />
                </Routes>
            </BrowserRouter>
        );
    }

    // Якщо авторизований - показуємо основну систему
    return (
        <BrowserRouter>
            <div className="app">
                <nav style={{
                    background: '#2c3e50',
                    padding: '15px 30px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    position: 'sticky',
                    top: 0,
                    zIndex: 100
                }}>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>🔧 Система управління ремонтною майстернею</h1>
                    <div>
                        <Link to="/" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>📋 Замовлення</Link>
                        <Link to="/new-order" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>➕ Нове замовлення</Link>
                        <Link to="/parts" style={{ color: 'white', marginRight: '15px', textDecoration: 'none' }}>🔩 Деталі</Link>
                        <span style={{ color: '#4c5c96', marginRight: '15px' }}>👤 {user?.username} ({user?.role})</span>
                        <button onClick={handleLogout} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer' }}>Вийти</button>
                    </div>
                </nav>
                <Routes>
                    <Route path="/" element={<OrdersList />} />
                    <Route path="/new-order" element={<NewOrderForm />} />
                    <Route path="/parts" element={<PartsInventory />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;