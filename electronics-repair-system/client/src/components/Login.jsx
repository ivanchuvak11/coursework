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
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                username,
                password
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
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
            <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '10px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                width: '400px'
            }}>
                <h2 style={{ color: '#333', marginBottom: '10px', fontSize: '1.2rem' }}>🔧 Система управління ремонтною майстернею</h2>
                <h3 style={{ color: '#666', marginBottom: '30px' }}>Вхід в систему</h3>
                
                {error && (
                    <div style={{
                        background: '#fed7d7',
                        color: '#c53030',
                        padding: '10px',
                        borderRadius: '5px',
                        marginBottom: '20px'
                    }}>
                        {error}
                    </div>
                )}
                
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '5px',
                            color: '#555',
                            fontWeight: 'bold'
                        }}>Логін</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                fontSize: '16px'
                            }}
                            placeholder="Введіть логін"
                        />
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '5px',
                            color: '#555',
                            fontWeight: 'bold'
                        }}>Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ddd',
                                borderRadius: '5px',
                                fontSize: '16px'
                            }}
                            placeholder="Введіть пароль"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '16px',
                            cursor: 'pointer',
                            transition: 'background 0.3s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#5a67d8'}
                        onMouseLeave={(e) => e.target.style.background = '#667eea'}
                    >
                        {loading ? 'Вхід...' : 'Увійти'}
                    </button>
                </form>
                
                <div style={{
                    marginTop: '20px',
                    padding: '10px',
                    background: '#f0f0f0',
                    borderRadius: '5px',
                    fontSize: '12px',
                    color: '#666'
                }}>
                    <p style={{ margin: '5px 0' }}><strong>Тестові дані:</strong></p>
                    <p style={{ margin: '5px 0' }}>👑 Адмін: admin / 123456</p>
                    <p style={{ margin: '5px 0' }}>🔧 Майстер: master1 / 123456</p>
                    <p style={{ margin: '5px 0' }}>📋 Менеджер: manager1 / 123456</p>
                </div>
            </div>
        </div>
    );
}