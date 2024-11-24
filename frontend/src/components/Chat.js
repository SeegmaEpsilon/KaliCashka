import React, { useState, useEffect } from 'react';
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
                setHistory(data.history || []); // Убедимся, что история — массив
            } catch (error) {
                console.error('Ошибка при загрузке истории:', error);
            }
        };

        fetchHistory();
    }, [token]);

    const handleSendDebounced = debounce(async (message, isCommand, token, setHistory) => {
        try {
            if (isCommand) {
                const response = await fetch('http://127.0.0.1:8000/execute-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ command: message.substring(1) }), // Убираем "/"
                });

                if (response.ok) {
                    const responseData = await response.json();

                    const kaliMessage = `Kali: В результате выполнения команды "${message.substring(1)}" получился такой результат: ${responseData.output}`;
                    const aiMessage = `В результате выполнения команды "${message.substring(1)}" получился такой результат: ${responseData.output}. Проанализируй его.`;

                    // Добавляем сообщение от Kali и сразу отправляем в AI
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: `Вы: ${message}`, bot: kaliMessage },
                    ]);

                    // Отправляем запрос в AI
                    const aiResponse = await fetch('http://127.0.0.1:8000/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ message: aiMessage }),
                    });

                    const aiResponseData = await aiResponse.json();
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: kaliMessage, bot: aiResponseData.response },
                    ]);
                } else {
                    const errorData = await response.json();
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: message, bot: `Ошибка: ${errorData.detail || 'Неизвестная ошибка.'}` },
                    ]);
                }
            } else {
                const response = await fetch('http://127.0.0.1:8000/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ message }),
                });

                const responseData = await response.json();
                setHistory((prevHistory) => [
                    ...prevHistory,
                    { user: message, bot: responseData.response },
                ]);
            }
        } catch (error) {
            console.error('Ошибка при обработке запроса:', error);
            setHistory((prevHistory) => [
                ...prevHistory,
                { user: message, bot: 'Ошибка при обработке вашего запроса.' },
            ]);
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
                {/* Сообщение пользователя */}
                {item.user && !item.user.startsWith('Kali:') && (
                    <p style={{ marginBottom: '4px' }}>
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
                )}

                {/* Сообщение от Kali */}
                {item.bot && item.bot.startsWith('Kali:') && (
                    <p style={{ marginBottom: '4px' }}>
                        <span
                            style={{
                                color: isDarkTheme ? '#4b83f5' : '#007bff',
                                fontWeight: 'bold',
                            }}
                        >
                            Kali:
                        </span>{' '}
                        {item.bot.replace('Kali: ', '')}
                    </p>
                )}

                {/* Сообщение от AI */}
                {item.bot && !item.bot.startsWith('Kali:') && (
                    <p style={{ marginBottom: '4px' }}>
                        <span
                            style={{
                                color: isDarkTheme ? '#d15050' : '#d9534f',
                                fontWeight: 'bold',
                            }}
                        >
                            Ответ:
                        </span>{' '}
                        {item.bot}
                    </p>
                )}
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
