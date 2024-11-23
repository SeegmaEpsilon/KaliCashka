import React, { useState, useEffect } from 'react';
import { sendMessage } from '../services/api';

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

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            const res = await sendMessage(message, token);
            setHistory([...history, { user: message, bot: res.response }]);
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = async () => {
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
                    {loading ? 'Отправка...' : 'Отправить'}
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
