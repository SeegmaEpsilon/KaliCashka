import React, { useState } from 'react';
import Chat from './components/Chat';
import Login from './pages/Login';
import logoDark from './assets/logo_theme_dark.png';
import logoLight from './assets/logo_theme_light.png';

function App() {
  const [token, setToken] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [username, setUsername] = useState('');

  const handleLogin = (accessToken, username) => {
    setToken(accessToken);
    setUsername(username);
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
            onClick={() => setToken(null)}
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
      <main>
        {!token ? (
          <Login onLogin={handleLogin} isDarkTheme={isDarkTheme} />
        ) : (
          <Chat token={token} isDarkTheme={isDarkTheme} />
        )}
      </main>
    </div>
  );
}

export default App;
