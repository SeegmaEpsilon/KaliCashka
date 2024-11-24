import React, { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

const Chat = ({ token, isDarkTheme }) => {
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const chatContainerRef = useRef(null); // Ссылка на контейнер чата

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/chat-history', {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                const data = await response.json();
                setHistory(data.history || []);
            } catch (error) {
                console.error('Ошибка при загрузке истории:', error);
            }
        };

        fetchHistory();
    }, [token]);

    // Автоматическая прокрутка при первом рендере и обновлении истории
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const formatMessage = (text) => {
        if (!text) return null;
    
        // Регулярные выражения
        const boldRegex = /\*\*(.*?)\*\*/g; // Для текста в двойных звёздочках
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g; // Для блоков кода с языковым идентификатором
    
        // Разделение текста на блоки и обработка
        const parts = [];
        let lastIndex = 0;
    
        text.replace(codeBlockRegex, (match, lang, code, offset) => {
            // Добавляем текст перед блоком кода
            if (offset > lastIndex) {
                parts.push({ type: 'text', content: text.slice(lastIndex, offset) });
            }
    
            // Добавляем сам блок кода
            parts.push({ type: 'code', language: lang || 'Code', content: code.trim() });
    
            lastIndex = offset + match.length;
        });
    
        // Добавляем оставшийся текст после последнего блока кода
        if (lastIndex < text.length) {
            parts.push({ type: 'text', content: text.slice(lastIndex) });
        }
    
        // Рендер частей
        return parts.map((part, index) => {
            if (part.type === 'code') {
                // Рендер блока кода
                return (
                    <div
                        key={index}
                        style={{
                            position: 'relative',
                            margin: '4px 0',
                        }}
                    >
                        {/* Заголовок для языка */}
                        <div
                            style={{
                                backgroundColor: '#444',
                                color: '#fff',
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderTopLeftRadius: '5px',
                                borderTopRightRadius: '5px',
                                display: 'inline-block',
                            }}
                        >
                            {part.language}
                        </div>
                        <pre
                            style={{
                                backgroundColor: '#2d2d2d',
                                color: '#ffffff',
                                padding: '8px',
                                borderRadius: '5px',
                                overflowX: 'auto',
                                marginTop: '0',
                                lineHeight: '1.4',
                                display: 'block',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {part.content}
                        </pre>
                    </div>
                );
            } else if (part.type === 'text') {
                // Рендер обычного текста с выделением
                return part.content
                    .split('\n') // Разделяем на строки
                    .filter((line) => line.trim() !== '') // Убираем пустые строки
                    .map((line, i) => {
                        const formattedLine = line.split(boldRegex).map((chunk, j) => {
                            if (j % 2 === 1) {
                                // Выделение жирным
                                return (
                                    <span
                                        key={`${index}-${i}-${j}`}
                                        style={{
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {chunk}
                                    </span>
                                );
                            }
                            return chunk;
                        });
    
                        return (
                            <span key={`${index}-${i}`} style={{ margin: 0, padding: 0 }}>
                                {formattedLine}
                                <br />
                            </span>
                        );
                    });
            }
            return null;
        });
    };
    
    
    

    const handleSendDebounced = debounce(async (message, isCommand, token, setHistory) => {
        try {
            if (isCommand) {
                const response = await fetch('http://127.0.0.1:8000/execute-command', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ command: message.substring(1) }),
                });

                if (response.ok) {
                    const responseData = await response.json();
                    const kaliMessage = `Kali: В результате выполнения команды "${message.substring(1)}" получился такой результат: ${responseData.output}`;
                    const aiMessage = `В результате выполнения команды "${message.substring(1)}" получился такой результат: ${responseData.output}. Проанализируй его.`;

                    // Добавляем сообщение пользователя
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: `Вы: ${message}`, bot: null },
                    ]);

                    // Ждём ответа от AI
                    const aiResponse = await fetch('http://127.0.0.1:8000/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ message: aiMessage }),
                    });

                    const aiResponseData = await aiResponse.json();

                    // Добавляем сообщение бота
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: null, bot: aiResponseData.response },
                    ]);
                } else {
                    const errorData = await response.json();

                    // Добавляем сообщение пользователя и ошибку
                    setHistory((prevHistory) => [
                        ...prevHistory,
                        { user: `Вы: ${message}`, bot: `Ошибка: ${errorData.detail || 'Неизвестная ошибка.'}` },
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

                // Добавляем сообщение пользователя
                setHistory((prevHistory) => [
                    ...prevHistory,
                    { user: `Вы: ${message}`, bot: null },
                ]);

                // Добавляем ответ от бота
                setHistory((prevHistory) => [
                    ...prevHistory,
                    { user: null, bot: responseData.response },
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
                ref={chatContainerRef} // Привязка ссылки
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
                            {item.user && (
                                <p style={{ marginBottom: '8px' }}>
                                    <span
                                        style={{
                                            color: isDarkTheme ? '#50b434' : '#50b434',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Вы:
                                    </span>{' '}
                                    {item.user.replace(/^Вы: /, '')}
                                </p>
                            )}
                            {item.bot && (
                                <p style={{ marginBottom: '8px' }}>
                                    <span
                                        style={{
                                            color: isDarkTheme ? '#d15050' : '#d9534f',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Ответ:
                                    </span>{' '}
                                    {formatMessage(item.bot)}
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
                <div className="d-flex gap-2 align-items-stretch">
                    <input
                        type="text"
                        className="form-control"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault(); // Предотвращает перенос строки
                                handleSend(); // Вызывает функцию отправки
                            }
                        }}
                        placeholder="Введите сообщение или команду. Команда должна начинаться с /"
                    />
                    <button
                        className="btn btn-primary flex-grow-1"
                        onClick={handleSend}
                        disabled={loading}
                    >
                        {loading ? 'Отправляем...' : 'Отправить'}
                    </button>
                    <button
                        className="btn btn-danger flex-grow-1"
                        onClick={handleClearHistory}
                    >
                        Очистить историю
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chat;
