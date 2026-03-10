// Инициализация VK
vkBridge.send('VKWebAppInit');

let USER_ID = null;
// Пока указываем ссылку на ваш основной сервер, чуть позже мы добавим туда этот эндпоинт
const API_URL = 'https://neuro-master.online/api/my_personal_ai'; 

// Получаем ваш ID
vkBridge.send('VKWebAppGetUserInfo')
    .then(data => { USER_ID = data.id; })
    .catch(console.error);

// Настройка красивой подсветки кода
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
});

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Функция добавления сообщения в чат
function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    
    if (isMarkdown) {
        div.innerHTML = marked.parse(text);
    } else {
        div.textContent = text;
    }
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Прокрутка вниз
}

// Отправка сообщения
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    if (!USER_ID) {
        alert("Подождите, ваш VK ID еще не загрузился.");
        return;
    }

    // 1. Показываем ваше сообщение
    appendMessage('user', text);
    userInput.value = '';
    sendBtn.disabled = true;
    
    // 2. Индикатор загрузки
    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.id = loadingId;
    loadingDiv.textContent = 'Думаю... ⏳';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 3. Отправка на ваш сервер
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: USER_ID, prompt: text })
        });
        const result = await response.json();
        
        // Удаляем индикатор загрузки
        chatBox.removeChild(document.getElementById(loadingId));

        if (result.success) {
            appendMessage('ai', result.response, true); // true = отрендерить код!
        } else {
            appendMessage('ai', '❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (e) {
        chatBox.removeChild(document.getElementById(loadingId));
        appendMessage('ai', '🌐 Ошибка сети: не могу связаться с сервером.');
    } finally {
        sendBtn.disabled = false;
    }
}

// Обработчик кнопки и клавиши Enter
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
