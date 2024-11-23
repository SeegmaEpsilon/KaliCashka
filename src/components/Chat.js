import React, { useState, useEffect } from 'react';
import { sendMessage } from '../services/api';
import { debounce } from 'lodash';

const Chat = ({ token }) => {
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

    const handleSendDebounced = debounce(async (message, isCommand, token, setHistory) => {
        try {
            let res;
            if (isCommand) {
                // Если это команда
                const response = await fetch('http://127.0.0.1:8000/execute-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ command: message }),
                });

                if (response.ok) {
                    res = await response.json();
                } else {
                    const errorData = await response.json();
                    res = { response: errorData.detail || 'Ошибка при выполнении команды.' };
                }
            } else {
                // Если это обычное сообщение
                res = await sendMessage(message, token);
            }

            setHistory((prevHistory) => [...prevHistory, { user: message, bot: res.response }]);
        } catch (error) {
            console.error('Ошибка при обработке запроса:', error);
            setHistory((prevHistory) => [...prevHistory, { user: message, bot: 'Ошибка при обработке вашего запроса.' }]);
        }
    }, 500);

    const handleSend = () => {
        if (!message.trim()) return;

        setLoading(true);

        try {
            const isCommand = message.startsWith('/');
            handleSendDebounced(message, isCommand, token, setHistory);
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
        const confirmed = window.confirm('Вы уверены, что хотите очистить всю историю чата?');
        if (!confirmed) return;

        try {
            await fetch('http://127.0.0.1:8000/chat/clear', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setHistory([]); // Очищаем историю на фронтенде
        } catch (error) {
            console.error('Ошибка при очистке истории:', error);
        }
    };

    return (
        <div className="container">
            <h2>Chat</h2>
            <div className="input-group mb-3">
                <input
                    type="text"
                    className="form-control"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Введите сообщение"
                />
                <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
                    {loading ? 'Отправляем...' : 'Отправить'}
                </button>
            </div>
            <button
                className="btn btn-danger mb-3"
                onClick={handleClearHistory}
                style={{ display: 'block', margin: '0 auto' }}
            >
                Очистить историю
            </button>
            <div className="mt-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
