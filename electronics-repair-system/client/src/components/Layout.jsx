import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Layout.css';

const Layout = ({ children, user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
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

      <main className="main-content">
        <div className="content-wrapper">{children}</div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <span>© REPAIRMASTER. Всі права захищені.</span>
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); setShowContacts(true); }}>Контакти</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowAbout(true); }}>Про систему</a>
          </div>
        </div>
      </footer>

      {/* МОДАЛЬНЕ ВІКНО "КОНТАКТИ" */}
      {showContacts && (
        <div className="modal-overlay" onClick={() => setShowContacts(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowContacts(false)}>✕</button>
            <h3>📞 Наші контакти</h3>
            <div className="contact-info">
              <p><strong>📱 Телефони:</strong></p>
              <p>+38 (099) 123-45-67</p>
              <p>+38 (067) 234-56-78</p>
              <p>+38 (093) 345-67-89</p>
            </div>
            <div className="contact-info">
              <p><strong>✉️ Email:</strong></p>
              <p>info@repairmaster.ua</p>
              <p>support@repairmaster.ua</p>
            </div>
            <div className="contact-info">
              <p><strong>🏢 Адреса:</strong></p>
              <p>м. Київ, вул. Ремонтна, 15</p>
            </div>
            <div className="contact-info">
              <p><strong>⏰ Графік роботи:</strong></p>
              <p>Пн-Пт: 9:00 - 19:00</p>
              <p>Сб: 10:00 - 16:00</p>
              <p>Нд: вихідний</p>
            </div>
          </div>
        </div>
      )}

{/* МОДАЛЬНЕ ВІКНО "КОНТАКТИ" */}
{showContacts && (
  <div className="modal-overlay" onClick={() => setShowContacts(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowContacts(false)}>✕</button>
      <h3>📞 Наші контакти</h3>
      <div className="modal-scroll">  {/* ← ДОДАТИ ЦЮ ОБГОРТКУ */}
        <div className="contact-info">
          <p><strong>📱 Телефони:</strong></p>
          <p>+38 (099) 123-45-67</p>
          <p>+38 (067) 234-56-78</p>
          <p>+38 (093) 345-67-89</p>
        </div>
        <div className="contact-info">
          <p><strong>✉️ Email:</strong></p>
          <p>info@repairmaster.ua</p>
          <p>support@repairmaster.ua</p>
        </div>
        <div className="contact-info">
          <p><strong>🏢 Адреса:</strong></p>
          <p>м. Київ, вул. Ремонтна, 15</p>
        </div>
        <div className="contact-info">
          <p><strong>⏰ Графік роботи:</strong></p>
          <p>Пн-Пт: 9:00 - 19:00</p>
          <p>Сб: 10:00 - 16:00</p>
          <p>Нд: вихідний</p>
        </div>
      </div>
    </div>
  </div>
)}

{/* МОДАЛЬНЕ ВІКНО "ПРО НАС" */}
{showAbout && (
  <div className="modal-overlay" onClick={() => setShowAbout(false)}>
    <div className="modal-content about-modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setShowAbout(false)}>✕</button>
      <h3>ℹ️ Про систему</h3>
      <div className="modal-scroll">  {/* ← ДОДАТИ ЦЮ ОБГОРТКУ */}
        <div className="about-info">
          <p><strong>REPAIRMASTER</strong> – це сучасна система управління ремонтною майстернею електроніки.</p>
        </div>
        <div className="about-info">
          <p><strong>🎯 Призначення системи:</strong></p>
          <p>Автоматизація роботи ремонтної майстерні, облік замовлень, контроль статусів ремонту, управління складом запчастин та комунікація з клієнтами.</p>
        </div>
        <div className="about-info">
          <p><strong>✅ Можливості:</strong></p>
          <ul>
            <li>📋 Реєстрація та відстеження замовлень на ремонт</li>
            <li>📊 Контроль статусу ремонту (прийнято, діагностика, ремонт, виконано)</li>
            <li>🔩 Облік використаних деталей та складу</li>
            <li>📱 SMS-сповіщення клієнтів про зміну статусу</li>
            <li>👥 Розмежування прав доступу (адмін, майстер, менеджер)</li>
            <li>📈 Звітність та аналітика</li>
          </ul>
        </div>
        <div className="about-info">
          <p><strong>👨‍💻 Для кого:</strong></p>
          <p>Для ремонтних майстерень, сервісних центрів, приватних майстрів з ремонту електроніки.</p>
        </div>
        <div className="about-info">
          <p><strong>🛠️ Технології:</strong></p>
          <p>React + Node.js + Express + PostgreSQL + JWT авторизація</p>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default Layout;
