import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', { username, password });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        onLogin(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Невірний логін або пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/images/logo.png" alt="Logo" className="login-logo-img" />
          <h2>REPAIR<span>MASTER</span></h2>
          <p>Вхід до системи управління</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Логін" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Вхід...' : 'Увійти'}</button>
        </form>
        <div className="test-creds">admin / 123456 &nbsp;|&nbsp; master1 / 123456</div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent; /* фон видно крізь картку */
        }
        .login-card {
          background: rgba(53, 56, 73, 0.85); /* напівпрозорий темний */
          backdrop-filter: blur(8px); /* ефект скла — можна прибрати */
          padding: 2rem;
          width: 360px;
          border-radius: 16px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.2);
          box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }
        .login-logo-img {
          width: 60px;
          height: 60px;
          margin-bottom: 1rem;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
          padding: 0.5rem;
        }
        .login-card h2 {
          font-family: 'Raleway', sans-serif;
          font-weight: 700;
          letter-spacing: 0.1em;
          font-size: 1.5rem;
          color: white;
        }
        .login-card h2 span { font-weight: 200; }
        .login-card p {
          color: rgba(255,255,255,0.7);
          margin-bottom: 1.5rem;
        }
        .login-card input {
          width: 100%;
          padding: 0.8rem;
          margin-bottom: 1rem;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          color: white;
          font-size: 0.9rem;
        }
        .login-card input::placeholder {
          color: rgba(255,255,255,0.5);
        }
        .login-card button {
          width: 100%;
          padding: 0.8rem;
          background: #4c5c96;
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 700;
          font-family: 'Raleway', sans-serif;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: 0.2s;
        }
        .login-card button:hover {
          background: #5c6ca6;
        }
        .error-message {
          background: rgba(220, 38, 38, 0.2);
          border: 1px solid #ef4444;
          padding: 0.5rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.8rem;
          color: #fca5a5;
        }
        .test-creds {
          margin-top: 1.5rem;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.5);
        }
      `}</style>
    </div>
  );
}