import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children, user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Замовлення' },
    { path: '/new-order', label: 'Нове замовлення' },
    { path: '/parts', label: 'Деталі' }
  ];

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="logo-area">
            <div className="logo-placeholder">
              <img src="/images/logo.png" alt="Logo" className="logo-img" />
            </div>
            <span className="logo-text">REPAIR<span>MASTER</span></span>
          </div>

          <nav className="desktop-nav">
            {navItems.map(item => (
              <Link key={item.path} to={item.path} className={location.pathname === item.path ? 'active' : ''}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="user-profile">
            <div className="user-avatar">
              <img src="/images/avatar.png" alt="Avatar" className="avatar-img" />
            </div>
            <span className="user-name">{user?.username}</span>
            <button onClick={onLogout} className="logout-btn">Вийти</button>
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>☰</button>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-nav">
            {navItems.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                {item.label}
              </Link>
            ))}
            <button onClick={onLogout} className="mobile-logout-btn">Вийти</button>
          </div>
        )}
      </header>

      <main className="main-content">{children}</main>

      <footer className="footer">
        <div className="footer-content">
          <span>© REPAIRMASTER. Всі права захищені.</span>
          <div className="footer-links">
            <a href="#">Про нас</a>
            <a href="#">Контакти</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;