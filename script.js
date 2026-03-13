// Инициализация vkBridge
vkBridge.send('VKWebAppInit');

let USER_ID = null;
const API_URL = 'https://neuro-master.online/api/my_personal_ai';

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
});

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const modelSelector = document.getElementById('modelSelector');

// Функция отрисовки сообщения
function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    if (isMarkdown) {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Инициализация
vkBridge.send('VKWebAppGetUserInfo')
    .then(data => { 
        USER_ID = data.id;
        loadHistory();
    })
    .catch(console.error);

// Улучшенная загрузка истории
function loadHistory() {
    // Загрузка из localStorage
    const savedHistory = localStorage.getItem(`chatHistory_${USER_ID}`);
    if (savedHistory) {
        const messages = JSON.parse(savedHistory);
        chatBox.innerHTML = '';
        messages.forEach(msg => {
            appendMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, msg.role !== 'user');
        });
    } else {
        // Приветственное сообщение
        appendMessage('ai', 'Привет! Я твой личный ассистент с памятью. Пиши код, задавай вопросы.');
    }
}

// Сохранение истории
function saveHistory(messages) {
    localStorage.setItem(`chatHistory_${USER_ID}`, JSON.stringify(messages));
}

// Обработчик изменения модели
modelSelector.addEventListener('change', function() {
    localStorage.setItem('selectedModel', this.value);
});

// Загрузка сохраненной модели
window.addEventListener('DOMContentLoaded', function() {
    const savedModel = localStorage.getItem('selectedModel') || 'gemini_flash';
    modelSelector.value = savedModel;
});

// Очистка базы данных (метелочка)
clearChatBtn.addEventListener('click', async () => {
    chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
    
    try {
        // Очистка на сервере
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: USER_ID, 
                prompt: "", 
                clear_history: true 
            })
        });
        const result = await response.json();
        
        if (result.success) {
            // Очистка на клиенте
            localStorage.removeItem(`chatHistory_${USER_ID}`);
            chatBox.innerHTML = '<div class="message ai-message">Память очищена! Я готов к новой задаче. 🧹</div>';
        } else {
            throw new Error(result.error || 'Неизвестная ошибка');
        }
    } catch(e) {
        chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка очистки. Попробуйте еще раз.</div>';
        // Загрузка предыдущей истории
        loadHistory();
    }
});

// Отправка сообщения
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!USER_ID) { 
        alert("Подождите, ваш VK ID еще не загрузился."); 
        return; 
    }

    // Сохранение текущего сообщения пользователя
    const userMessage = { role: 'user', content: text };
    const messages = getCurrentMessages();
    messages.push(userMessage);
    saveHistory(messages);

    appendMessage('user', text);
    userInput.value = '';
    sendBtn.disabled = true;

    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.id = loadingId;
    loadingDiv.textContent = 'Думаю... ⏳';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: USER_ID, 
                prompt: text, 
                model_type: modelSelector.value 
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        chatBox.removeChild(document.getElementById(loadingId));

        if (result.success) {
            // Сохранение ответа от сервера
            const aiMessage = { role: 'assistant', content: result.response };
            messages.push(aiMessage);
            saveHistory(messages);
            
            appendMessage('ai', result.response, true);
        } else {
            throw new Error(result.error || 'Неизвестная ошибка сервера');
        }
    } catch (e) {
        chatBox.removeChild(document.getElementById(loadingId));
        appendMessage('ai', `❌ Ошибка: ${e.message || 'Проверьте соединение'}`);
        console.error(e);
    } finally {
        sendBtn.disabled = false;
    }
}

// Получение текущих сообщений из localStorage
function getCurrentMessages() {
    const savedHistory = localStorage.getItem(`chatHistory_${USER_ID}`);
    return savedHistory ? JSON.parse(savedHistory) : [];
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
