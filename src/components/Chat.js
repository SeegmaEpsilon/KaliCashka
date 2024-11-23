import React, { useState, useEffect } from 'react';
import { sendMessage } from '../services/api';

const Chat = ({ token, isDarkTheme }) => {
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/chat/history', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await response.json();
                setHistory(data.history);
            } catch (error) {
                console.error('Ошибка при загрузке истории:', error);
            }
        };

        fetchHistory();
    }, [token]);

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);

        try {
            let res;
            if (message.startsWith('/')) {
                const response = await fetch('http://127.0.0.1:8000/execute-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ command: message }),
                });
                res = await response.json();
            } else {
                res = await sendMessage(message, token);
            }

            setHistory([...history, { user: message, bot: res.response }]);
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        } finally {
            setLoading(false);
        }
    };

    const chatStyle = {
        backgroundColor: isDarkTheme ? '#2d2f34' : '#f8f9fa',
        color: isDarkTheme ? '#ffffff' : '#000000',
        padding: '10px',
        borderRadius: '10px',
        maxHeight: '400px',
        overflowY: 'auto',
    };

    return (
        <div className="container">
            <h2>Чат</h2>
            <div className="input-group mb-3">
                <input
                    type="text"
                    className="form-control"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Введите сообщение или команду (например, /nmap)"
                />
                <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
                    {loading ? 'Отправка...' : 'Отправить'}
                </button>
            </div>
            <div className="mt-4" style={chatStyle}>
                <h3>История чата:</h3>
                {history.map((item, index) => (
                    <div key={index} className="mb-3">
                        <p><strong>Вы:</strong> {item.user}</p>
                        <p><strong>Ответ:</strong> {item.bot}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Chat;
