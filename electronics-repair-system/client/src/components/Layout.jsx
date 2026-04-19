import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children, user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: '📊 Замовлення', icon: '📊' },
    { path: '/new-order', label: '➕ Нове замовлення', icon: '➕' },
    { path: '/parts', label: '🔩 Деталі', icon: '🔩' }
  ];

  return (
    <div className="app-container">
      {/* Шапка */}
      <header className="header">
        <div className="header-content">
          <div className="logo-area">
            <div className="logo-placeholder">
              {/* ТУТ БУДЕ ФОТО ЛОГОТИПУ */}
              <div className="photo-slot logo-slot" data-text="Тут буде логотип"></div>
            </div>
            <div className="logo-text">
              <h1>REPAIR<span>MASTER</span></h1>
              <p>Ремонтна майстерня електроніки</p>
            </div>
          </div>

          {/* Десктоп навігація */}
          <nav className="desktop-nav">
            {navItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Профіль */}
          <div className="user-profile">
            <div className="user-avatar-placeholder">
              {/* ТУТ БУДЕ ФОТО АВАТАРКИ */}
              <div className="photo-slot avatar-slot" data-text="Фото"></div>
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username || 'Користувач'}</span>
              <span className="user-role">{user?.role || 'роль'}</span>
            </div>
            <button onClick={onLogout} className="logout-btn">
              🚪 Вийти
            </button>
          </div>

          {/* Мобільне меню */}
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
        </div>

        {/* Мобільна навігація */}
        {mobileMenuOpen && (
          <div className="mobile-nav">
            {navItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
            <button onClick={onLogout} className="mobile-logout-btn">
              🚪 Вийти
            </button>
          </div>
        )}
      </header>

      {/* Головний контент */}
      <main className="main-content">
        <div className="content-wrapper">
          {children}
        </div>
      </main>

      {/* Підвал */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo-placeholder-small">
              {/* ТУТ БУДЕ МАЛЕНЬКЕ ФОТО */}
              <div className="photo-slot-small"></div>
            </div>
            <span>RepairMaster © 2024</span>
          </div>
          <div className="footer-links">
            <a href="#">Про нас</a>
            <a href="#">Контакти</a>
            <a href="#">Політика</a>
          </div>
          <div className="footer-social">
            {/* ТУТ БУДУТЬ ІКОНКИ СОЦМЕРЕЖ */}
            <div className="social-placeholder">📱</div>
            <div className="social-placeholder">💬</div>
            <div className="social-placeholder">📧</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;