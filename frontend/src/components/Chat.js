import React, { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

const Chat = ({ token, isDarkTheme }) => {
    const [message, setMessage] = useState('');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPentestForm, setShowPentestForm] = useState(false);
    const [pentestData, setPentestData] = useState({
        targetAddress: '',
        targetName: ''
    });
    const chatContainerRef = useRef(null); // Ссылка на контейнер чата

    // Создаем стили для скроллбара
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .custom-scrollbar::-webkit-scrollbar {
                width: 8px;
                background-color: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: ${isDarkTheme ? '#4a4d57' : '#f1f1f1'};
                border-radius: 0 16px 16px 0;
                margin: 4px 0;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: ${isDarkTheme ? '#666' : '#888'};
                border-radius: 20px;
                border: 2px solid ${isDarkTheme ? '#545762' : '#ebebeb'};
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: ${isDarkTheme ? '#777' : '#999'};
            }
            .custom-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: ${isDarkTheme ? '#666 #4a4d57' : '#888 #f1f1f1'};
            }
            .chat-input::placeholder {
                font-size: 11px;
                opacity: 0.8;
                color: ${isDarkTheme ? '#aaa' : '#666'};
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, [isDarkTheme]);

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
        const inlineCodeRegex = /(?<!`)`([^`\n]+?)`(?!`)/g; // Для текста в одиночных бэктиках, исключая тройные
    
        // Разделение текста на блоки и обработка
        const parts = [];
        let lastIndex = 0;
    
        // Сначала обрабатываем блоки кода
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
                // Рендер обычного текста с выделением и инлайн-кодом
                return part.content
                    .split('\n') // Разделяем на строки
                    .filter((line) => line.trim() !== '') // Убираем пустые строки
                    .map((line, i) => {
                        // Сначала обрабатываем инлайн-код
                        const parts = [];
                        let lastInlineIndex = 0;
                        
                        line.replace(inlineCodeRegex, (match, code, offset) => {
                            // Добавляем текст до инлайн-кода
                            if (offset > lastInlineIndex) {
                                parts.push({
                                    type: 'normal',
                                    content: line.slice(lastInlineIndex, offset)
                                });
                            }
                            
                            // Добавляем инлайн-код
                            parts.push({
                                type: 'inline-code',
                                content: code
                            });
                            
                            lastInlineIndex = offset + match.length;
                        });
                        
                        // Добавляем оставшийся текст
                        if (lastInlineIndex < line.length) {
                            parts.push({
                                type: 'normal',
                                content: line.slice(lastInlineIndex)
                            });
                        }
                        
                        // Если не было найдено инлайн-кода, обрабатываем как обычный текст
                        if (parts.length === 0) {
                            parts.push({
                                type: 'normal',
                                content: line
                            });
                        }
                        
                        // Обрабатываем каждую часть
                        const formattedParts = parts.map((part, j) => {
                            if (part.type === 'inline-code') {
                                return (
                                    <code
                                        key={`${index}-${i}-${j}`}
                                        style={{
                                            backgroundColor: isDarkTheme ? '#2d2d2d' : '#f0f0f0',
                                            color: isDarkTheme ? '#ffffff' : '#333333',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontFamily: 'monospace',
                                            fontSize: '0.9em',
                                        }}
                                    >
                                        {part.content}
                                    </code>
                                );
                            } else {
                                // Обрабатываем жирный текст в обычных частях
                                return part.content.split(boldRegex).map((chunk, k) => {
                                    if (k % 2 === 1) {
                                        return (
                                            <span
                                                key={`${index}-${i}-${j}-${k}`}
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
                            }
                        });

                        return (
                            <span key={`${index}-${i}`} style={{ margin: 0, padding: 0 }}>
                                {formattedParts}
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

        const trimmedMessage = message.trim().toLowerCase();
        console.log('Отправляемое сообщение:', trimmedMessage);

        if (trimmedMessage === 'start-autopentest' || trimmedMessage === 'auto-pentest') {
            console.log('Открываем форму пентеста');
            setShowPentestForm(true);
            setMessage('');
            return;
        }

        setLoading(true);

        try {
            const isCommand = message.startsWith('/');
            handleSendDebounced(message, isCommand, token, setHistory);
            setMessage('');
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
        }
    };

    const handleStartPentest = () => {
        console.log('Запуск пентеста:', pentestData);
        if (!pentestData.targetAddress || !pentestData.targetName) {
            alert('Пожалуйста, заполните все поля');
            return;
        }
        
        setShowPentestForm(false);
        setHistory(prev => [...prev, {
            user: `Вы: Запущен автоматический пентест для цели ${pentestData.targetName} (${pentestData.targetAddress})`,
            bot: null
        }]);
        setPentestData({ targetAddress: '', targetName: '' });
    };

    const handleCancelPentest = () => {
        console.log('Отмена пентеста');
        setShowPentestForm(false);
        setPentestData({ targetAddress: '', targetName: '' });
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
        <div className="container" style={{ 
            maxWidth: '800px',
            margin: '0 auto',
            padding: '10px'
        }}>
            <h2 className="text-center mb-2">Чат</h2>
            <div
                ref={chatContainerRef}
                className="chat-history custom-scrollbar"
                style={{
                    maxHeight: '500px',
                    overflowY: 'auto',
                    marginBottom: '15px',
                    padding: '20px',
                    backgroundColor: isDarkTheme ? '#545762' : '#ebebeb',
                    color: isDarkTheme ? '#ffffff' : '#000000',
                    borderRadius: '16px',
                    height: '65vh',
                    boxShadow: isDarkTheme ? '0 4px 6px rgba(0, 0, 0, 0.2)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
                    position: 'relative'
                }}
            >
                {/* История чата */}
                {history.length === 0 ? (
                    <p className="text-center text-muted">История пуста</p>
                ) : (
                    history.map((item, index) => (
                        <div key={index} className="mb-3">
                            {item.user && (
                                <p style={{ 
                                    marginBottom: '12px',
                                    backgroundColor: isDarkTheme ? '#4a4d57' : '#f5f5f5',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                }}>
                                    <span
                                        style={{
                                            color: isDarkTheme ? '#50b434' : '#50b434',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Вы:
                                    </span>{' '}
                                    {formatMessage(item.user.replace(/^Вы: /, ''))}
                                </p>
                            )}
                            {item.bot && (
                                <p style={{ 
                                    marginBottom: '12px',
                                    backgroundColor: isDarkTheme ? '#4a4d57' : '#f5f5f5',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                }}>
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

                {/* Модальное окно пентеста */}
                {showPentestForm && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                    }}>
                        <div style={{
                            backgroundColor: isDarkTheme ? '#4a4d57' : '#ffffff',
                            padding: '20px',
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            width: '80%',
                            maxWidth: '400px',
                        }}>
                            <h3 style={{ 
                                marginBottom: '20px',
                                color: isDarkTheme ? '#ffffff' : '#000000',
                                fontSize: '18px',
                                textAlign: 'center'
                            }}>
                                Автоматический пентест
                            </h3>
                            <div style={{ marginBottom: '15px' }}>
                                <input
                                    type="text"
                                    placeholder="Адрес цели"
                                    value={pentestData.targetAddress}
                                    onChange={(e) => setPentestData(prev => ({ ...prev, targetAddress: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: isDarkTheme ? '1px solid #666' : '1px solid #ddd',
                                        backgroundColor: isDarkTheme ? '#545762' : '#ffffff',
                                        color: isDarkTheme ? '#ffffff' : '#000000',
                                        marginBottom: '10px',
                                        outline: 'none'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Название цели"
                                    value={pentestData.targetName}
                                    onChange={(e) => setPentestData(prev => ({ ...prev, targetName: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: isDarkTheme ? '1px solid #666' : '1px solid #ddd',
                                        backgroundColor: isDarkTheme ? '#545762' : '#ffffff',
                                        color: isDarkTheme ? '#ffffff' : '#000000',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div style={{ 
                                display: 'flex',
                                gap: '10px',
                                justifyContent: 'flex-end'
                            }}>
                                <button
                                    onClick={handleCancelPentest}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: isDarkTheme ? '#666' : '#e0e0e0',
                                        color: isDarkTheme ? '#ffffff' : '#000000',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleStartPentest}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#4CAF50',
                                        color: '#ffffff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Начать
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ 
                display: 'flex',
                gap: '10px',
                alignItems: 'stretch'
            }}>
                <input
                    type="text"
                    className="chat-input"
                    style={{
                        flex: '1',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        border: isDarkTheme ? '1px solid #666' : '1px solid #ddd',
                        backgroundColor: isDarkTheme ? '#4a4d57' : '#ffffff',
                        color: isDarkTheme ? '#ffffff' : '#000000',
                        outline: 'none',
                        fontSize: '13px',
                    }}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Введите команду с / или start-autopentest для автопентеста"
                />
                <button
                    style={{
                        padding: '12px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: isDarkTheme ? '#4CAF50' : '#4CAF50',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: '500',
                    }}
                    onClick={handleSend}
                    disabled={loading}
                >
                    {loading ? 'Отправляем...' : 'Отправить'}
                </button>
                <button
                    style={{
                        padding: '12px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        backgroundColor: isDarkTheme ? '#d9534f' : '#d9534f',
                        color: '#ffffff',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        fontWeight: '500',
                    }}
                    onClick={handleClearHistory}
                >
                    Очистить
                </button>
            </div>
        </div>
    );
};

export default Chat;
