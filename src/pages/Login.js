import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin, isDarkTheme }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const devUsername = 'dev';
    const devPassword = 'devpass';

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (username === devUsername && password === devPassword) {
            const fakeToken = 'dev-token';
            onLogin(fakeToken);
            return;
        }

        try {
            const response = await axios.post('http://127.0.0.1:8000/login', {
                username,
                password,
            });
            const { access_token } = response.data;
            onLogin(access_token);
        } catch (err) {
            setError('Неверный логин или пароль');
        }
    };

    const loginStyle = {
        backgroundColor: isDarkTheme ? '#2d2f34' : '#f8f9fa',
        color: isDarkTheme ? '#ffffff' : '#000000',
        padding: '20px',
        borderRadius: '10px',
        maxWidth: '400px',
        margin: 'auto',
        marginTop: '100px',
    };

    return (
        <div style={loginStyle}>
            <h2>Вход</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
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
                <button type="submit" className="btn btn-primary w-100">Войти</button>
            </form>
        </div>
    );
};

export default Login;

