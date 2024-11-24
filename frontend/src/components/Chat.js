import React, { useState, useEffect } from 'react';
import { sendMessage } from '../services/api';
import { debounce } from 'lodash';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
        } finally {
            setLoading(false);
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

    const formatMessage = (message) => {
        const regex = /```([\s\S]*?)```/g;
        const parts = message.split(regex);
        return parts.map((part, index) => {
            if (index % 2 === 0) {
                return <span key={index}>{part}</span>;
            } else {
                return (
                    <div key={index} style={{ margin: '10px 0' }}>
                        <SyntaxHighlighter language="bash" style={dracula}>
                            {part.trim()}
                        </SyntaxHighlighter>
                    </div>
                );
            }
        });
    };

    return (
        <div className="container">
            <h2 className="text-center mb-4">Чат</h2>
            <div
                className="chat-history"
                style={{
                    maxHeight: '500px',
                    overflowY: 'auto',
                    marginBottom: '20px',
                    padding: '10px',
                    backgroundColor: isDarkTheme ? '#545762' : '#ebebeb',
                    color: isDarkTheme ? '#ffffff' : '#000000',
                    borderRadius: '10px',
                    height: '60vh',
                }}
            >
                {history.length === 0 ? (
                    <p className="text-center text-muted">История пуста</p>
                ) : (
                    history.map((item, index) => (
                        <div key={index} className="mb-3">
                            <p>
                                <span
                                    style={{
                                        color: isDarkTheme ? '#50b434' : '#50b434',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    Вы:
                                </span>{' '}
                                {item.user}
                            </p>
                            <p>
                                <span
                                    style={{
                                        color: isDarkTheme ? '#d15050' : '#d15050',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    Ответ:
                                </span>{' '}
                                {formatMessage(item.bot)}
                            </p>
                        </div>
                    ))
                )}
                {loading && (
                    <div className="text-center mt-3">
                        <div className="spinner-border text-light" role="status">
                            <span className="sr-only">Загрузка...</span>
                        </div>
                    </div>
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
                </div>
            </div>
            <button
                className="btn btn-danger w-100 mt-3"
                onClick={handleClearHistory}
            >
                Очистить историю
            </button>
        </div>
    );
};

export default Chat;
