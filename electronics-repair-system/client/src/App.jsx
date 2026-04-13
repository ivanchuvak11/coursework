import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import OrdersList from './components/OrdersList';
import NewOrderForm from './components/NewOrderForm';
import PartsInventory from './components/PartsInventory';
import './App.css';

function App() {
    return (
        <BrowserRouter>
            <div className="app">
                <nav className="navbar">
                    <h1>🔧 Ремонтна майстерня електроніки</h1>
                    <div>
                        <Link to="/">📋 Замовлення</Link>
                        <Link to="/new-order">➕ Нове замовлення</Link>
                        <Link to="/parts">🔩 Деталі</Link>
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