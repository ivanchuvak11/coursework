import React, { useState } from 'react';
import axios from 'axios';
import './SharedStyles.css';

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
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username, password
      });
      
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        onLogin(response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка входу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Місце для фото фону */}
      <div className="login-bg-photo">
        <div className="photo-placeholder large">
          <span>📸 Тут буде фото майстерні (фон)</span>
        </div>
      </div>
      
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-placeholder-login">
            {/* ТУТ БУДЕ ФОТО ЛОГОТИПУ */}
            <div className="photo-slot" data-text="Логотип"></div>
          </div>
          <h2>REPAIR<span>MASTER</span></h2>
          <p>Вхід в систему управління</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Логін</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin / master1 / manager1"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="123456"
              required
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>
        
        <div className="test-credentials">
          <p> Тестові дані:</p>
          <p> admin / 123456 &nbsp;|&nbsp; master1 / 123456 &nbsp;|&nbsp;  manager1 / 123456</p>
        </div>
      </div>
    </div>
  );
}