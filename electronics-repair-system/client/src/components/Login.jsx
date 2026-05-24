import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ClipboardList, Eye, EyeOff, Package, ReceiptText, ShieldCheck } from 'lucide-react';
import '../styles/Login.css';

const featureItems = [
  {
    icon: ClipboardList,
    title: 'Замовлення',
    description: 'Контроль статусів, клієнтів і пристроїв в одному робочому просторі.',
  },
  {
    icon: Package,
    title: 'Склад',
    description: 'Облік деталей, залишків і вартості запчастин для ремонту.',
  },
  {
    icon: ReceiptText,
    title: 'Квитанції',
    description: 'Друк квитанцій та підсумкова вартість виконаних робіт.',
  },
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { username, password });

      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        axios.defaults.headers.common.Authorization = `Bearer ${response.data.token}`;
        onLogin(response.data.user);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Невірний логін або пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-info-panel" aria-label="Можливості системи">
          <div className="login-brand-row">
            <div>
              <p className="login-kicker">Панель майстерні</p>
              <h1>
                Смарт<span>лайф</span>
              </h1>
              <p>Система для щоденної роботи сервісного центру.</p>
            </div>
          </div>

          <div className="login-feature-list">
            {featureItems.map((item) => {
              const Icon = item.icon;

              return (
                <article className="login-feature" key={item.title}>
                  <span className="login-feature-icon">
                    <Icon size={22} strokeWidth={1.9} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="login-security-note">
            <ShieldCheck size={19} strokeWidth={1.9} />
            <span>Захищений вхід для працівників майстерні</span>
          </div>
        </section>

        <section className="login-card" aria-label="Вхід до системи">
          <div className="login-logo">
            <h2>Вхід</h2>
            <p>Увійдіть, щоб продовжити роботу із замовленнями</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Логін
              <input type="text" placeholder="Введіть логін" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>

            <label>
              Пароль
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Введіть пароль"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  aria-label={showPassword ? 'Сховати пароль' : 'Показати пароль'}
                >
                  {showPassword ? <EyeOff size={19} strokeWidth={1.9} /> : <Eye size={19} strokeWidth={1.9} />}
                </button>
              </span>
            </label>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Вхід...' : 'Увійти'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
