import React, { useState, useEffect } from 'react';
import { sendMessage } from '../services/api';
import { debounce } from 'lodash';

const Chat = ({ token, isDarkTheme }) => {
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/chat-history', {
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

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:8000/upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json();
            setHistory([...history, { user: file.name, bot: data.response }]);
        } catch (error) {
            console.error('Ошибка при загрузке файла:', error);
        }
    };

    const handleSendDebounced = debounce(async (message, isCommand, token, setHistory) => {
        try {
            let res;
            if (isCommand) {
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
            await fetch('http://127.0.0.1:8000/chat-history', {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setHistory([]);
        } catch (error) {
            console.error('Ошибка при очистке истории:', error);
        }
    };

    return (
        <div className="container">
            <h2 className="text-center mb-4">Чат</h2>
            <div className="chat-container p-3 mb-4">
                <div
                    className="chat-history"
                    style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginBottom: '20px',
                        padding: '10px',
                        backgroundColor: isDarkTheme ? '#545762' : '#ebebeb', // Фон чата
                        color: isDarkTheme ? '#ffffff' : '#000000', // Цвет текста
                        borderRadius: '10px',
                    }}
                >
                    {history.length === 0 ? (
                        <p className="text-center text-muted">История пуста</p>
                    ) : (
                        history.map((item, index) => (
                            <div key={index} className="mb-3">
                                <p>
                                    <strong>Вы:</strong> {item.user}
                                </p>
                                <p>
                                    <strong>Ответ:</strong> {item.bot}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                <div className="chat-input">
                    <div className="d-flex gap-2">
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
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                                className="btn btn-secondary"
                                style={{
                                    cursor: 'pointer',
                                    padding: '10px 20px',
                                    backgroundColor: isDarkTheme ? '#6c757d' : '#e0e0e0',
                                    color: isDarkTheme ? '#ffffff' : '#000000',
                                    borderRadius: '5px',
                                    border: 'none',
                                    whiteSpace: 'nowrap',
                                }}
                                onClick={() => document.getElementById('fileInput').click()}
                            >
                                Загрузить файл... (в разработке)
                            </button>
                            <input
                                id="fileInput"
                                type="file"
                                onChange={handleFileUpload}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    opacity: 0,
                                    width: '100%',
                                    height: '100%',
                                    cursor: 'pointer',
                                }}
                            />
                        </div>
                    </div>
                </div>
                <button
                    className="btn btn-danger w-100 mt-3"
                    onClick={handleClearHistory}
                >
                    Очистить историю
                </button>
            </div>
        </div>
    );
};

export default Chat;
