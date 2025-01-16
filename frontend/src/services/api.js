import axios from 'axios';

// Базовый URL бэкенда
const API_URL = 'http://127.0.0.1:8000';

const api = axios.create({
    baseURL: API_URL,
});

// Функция для отправки чата
export const sendMessage = async (message, token) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await api.post('/chat', { message }, { headers });
    return response.data;
};

export default api;
