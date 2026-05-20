import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Login.css';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <div className="login-card">
        <div className="login-logo">
          <img src="/images/logo.png" alt="Самарт лайф" className="login-logo-img" />
          <h2>
            Самарт <span>лайф</span>
          </h2>
          <p>Вхід до системи управління</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <input type="text" placeholder="Логін" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
        <div className="test-creds">admin / 123456 | master1 / 123456</div>
      </div>
    </div>
  );
}
