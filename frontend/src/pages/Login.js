import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin, isDarkTheme, onSwitchToRegister }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); // Включаем индикатор загрузки

        try {
            const response = await axios.post('http://127.0.0.1:8000/login', new URLSearchParams({
                username,
                password,
            }));
            const { access_token } = response.data;
            onLogin(access_token, username);
        } catch (err) {
            setError('Неверный логин или пароль');
        } finally {
            setLoading(false); // Выключаем индикатор загрузки
        }
    };

	// Я понимаю что тупо хардкодить css в код, но пока так
    const loginStyle = {
        backgroundColor: isDarkTheme ? '#2d2f34' : '#f8f9fa',
        color: isDarkTheme ? '#ffffff' : '#000000',
        padding: '20px',
        borderRadius: '10px',
        maxWidth: '400px',
        margin: 'auto',
        marginTop: '100px',
        textAlign: 'center',
        transition: 'background-color 0.5s ease, color 0.5s ease',
    };

    return (
        <div style={loginStyle}>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <h2 style={{ marginBottom: '20px' }}>Вход</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <label className="form-label">Логин</label>
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Пароль</label>
                    <input
                        type="password"
                        className="form-control"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? 'Входим...' : 'Войти'}
                </button>
            </form>
            <p className="mt-3 text-center">
                Нет аккаунта?{' '}
                <button
                    className="btn btn-link p-0"
                    onClick={onSwitchToRegister}
                    style={{
                        color: isDarkTheme ? '#ffffff' : '#000000',
                        textDecoration: 'underline',
                        verticalAlign: 'baseline',
                        padding: '0',
                    }}
                >
                    Зарегистрироваться
                </button>
            </p>
        </div>
    );
};

export default Login;
