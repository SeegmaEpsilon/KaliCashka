import React, { useState } from 'react';
import Chat from './components/Chat';
import Login from './pages/Login';
import Register from './pages/Register';
import logoDark from './assets/logo_theme_dark.png';
import logoLight from './assets/logo_theme_light.png';
import { useEffect } from 'react';

function App() {
  const [token, setToken] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [username, setUsername] = useState('');
  const [isRegistering, setIsRegistering] = useState(false); // По умолчанию форма входа

  useEffect(() => {
    // Загружаем токен из localStorage при загрузке страницы
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    if (storedToken) {
      setToken(storedToken);
      setUsername(storedUsername || '');
    }
  }, []);

  const handleLogin = (accessToken, username) => {
    setToken(accessToken);
    setUsername(username);
    localStorage.setItem('token', accessToken); // Сохраняем токен
    localStorage.setItem('username', username); // Сохраняем имя пользователя
  };

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token'); // Удаляем токен из localStorage
    localStorage.removeItem('username'); // Удаляем имя пользователя
  };

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  const appStyle = {
    backgroundColor: isDarkTheme ? '#3c3f48' : '#ffffff',
    color: isDarkTheme ? '#ffffff' : '#000000',
    minHeight: '100vh',
    padding: '20px',
    position: 'relative',
    transition: 'background-color 0.5s ease, color 0.5s ease', // Плавный переход
  };

  const currentLogo = isDarkTheme ? logoDark : logoLight;

  return (
    <div className="App" style={appStyle}>
      {/* Верхний правый блок (Переключатель темы + кнопка "Выйти") */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {token && <span style={{ marginRight: '10px' }}>Привет, <strong>{username}</strong></span>}
        <label
          className="theme-switch"
          style={{
            display: 'inline-block',
            position: 'relative',
            width: '60px',
            height: '34px',
          }}
        >
          <input
            type="checkbox"
            checked={!isDarkTheme}
            onChange={toggleTheme}
            style={{ display: 'none' }}
          />
          <span
            className="slider"
            style={{
              position: 'absolute',
              cursor: 'pointer',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDarkTheme ? '#ffffff' : '#3c3f48',
              transition: '.4s',
              borderRadius: '34px',
            }}
          >
            <span
              style={{
                position: 'absolute',
                height: '26px',
                width: '26px',
                left: isDarkTheme ? '4px' : '30px',
                bottom: '4px',
                backgroundColor: isDarkTheme ? '#3c3f48' : '#ffffff',
                transition: '.4s',
                borderRadius: '50%',
              }}
            />
          </span>
        </label>
        {token && (
          <button
            onClick={handleLogout} // Добавляем вызов функции выхода
            style={{
              backgroundColor: isDarkTheme ? '#ffffff' : '#3c3f48',
              color: isDarkTheme ? '#000000' : '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        )}
      </div>

      <header style={{ textAlign: 'center', marginBottom: '20px' }}>
        <img src={currentLogo} alt="KaliCashka Logo" style={{ width: '150px', marginBottom: '10px' }} />
        {!token && <h1>Добро пожаловать в KaliCashka</h1>}
      </header>
      <main className={`fade-in`}>
        {!token ? (
          isRegistering ? (
            <Register
              onRegister={() => setIsRegistering(false)}
              isDarkTheme={isDarkTheme}
              onSwitchToLogin={() => setIsRegistering(false)}
            />
          ) : (
            <Login
              onLogin={handleLogin}
              isDarkTheme={isDarkTheme}
              onSwitchToRegister={() => setIsRegistering(true)}
            />
          )
        ) : (
          <Chat token={token} isDarkTheme={isDarkTheme} />
        )}
      </main>
    </div>
  );
}

export default App;
