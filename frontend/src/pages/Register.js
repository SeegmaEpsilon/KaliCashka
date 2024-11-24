import React, { useState } from 'react';
import axios from 'axios';

const Register = ({ onRegister, isDarkTheme, onSwitchToLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await axios.post('http://127.0.0.1:8000/register', {
                username,
                password,
            });
            onRegister();
        } catch (err) {
            setError('Ошибка при регистрации. Попробуйте другой логин.');
        } finally {
            setLoading(false);
        }
    };

    const registerStyle = {
        backgroundColor: isDarkTheme ? '#2d2f34' : '#f8f9fa',
        color: isDarkTheme ? '#ffffff' : '#000000',
        padding: '20px',
        borderRadius: '10px',
        maxWidth: '400px',
        margin: 'auto',
        marginTop: '100px',
        transition: 'background-color 0.5s ease, color 0.5s ease',
        textAlign: 'center',
    };

    return (
        <div style={registerStyle}>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Регистрация</h2>
            <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
                <div className="mb-3">
                    <label className="form-label">Логин</label>
                    <input
                        type="text"
                        className="form-control"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        style={{ display: 'block', margin: '0 auto', width: '100%' }} // Центрируем поле
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
                        style={{ display: 'block', margin: '0 auto', width: '100%' }} // Центрируем поле
                    />
                </div>
                <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                    {loading ? 'Регистрируем...' : 'Зарегистрироваться'}
                </button>
            </form>
            <p className="mt-3 text-center">
                Уже есть аккаунт?{' '}
                <button
                    className="btn btn-link p-0"
                    onClick={onSwitchToLogin}
                    style={{
                        color: isDarkTheme ? '#ffffff' : '#000000',
                        textDecoration: 'underline',
                        verticalAlign: 'baseline',
                        padding: '0',
                    }}
                >
                    Войти
                </button>
            </p>
        </div>
    );


};

export default Register;
