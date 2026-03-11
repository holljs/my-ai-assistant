vkBridge.send('VKWebAppInit');

let USER_ID = null;
const API_URL = 'https://neuro-master.online/api/my_personal_ai'; 

// --- МАССИВ ДЛЯ ХРАНЕНИЯ ПАМЯТИ ---
let chatHistory = []; 

vkBridge.send('VKWebAppGetUserInfo')
    .then(data => { USER_ID = data.id; })
    .catch(console.error);

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
});

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn'); // Кнопка очистки

// Функция очистки чата
clearChatBtn.addEventListener('click', () => {
    chatHistory = []; // Сбрасываем память в коде
    // Оставляем только приветственное сообщение
    chatBox.innerHTML = `
        <div class="message ai-message">
            Память очищена! Я готов к новой задаче. 🧹
        </div>
    `;
});

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

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    if (!USER_ID) { alert("Подождите, ваш VK ID еще не загрузился."); return; }

    appendMessage('user', text);
    userInput.value = '';
    sendBtn.disabled = true;
    
    // Добавляем сообщение пользователя в память
    chatHistory.push({ role: "user", content: text });

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
            // ОТПРАВЛЯЕМ НЕ ПРОСТО ТЕКСТ, А ВСЮ ИСТОРИЮ!
            body: JSON.stringify({ user_id: USER_ID, history: chatHistory }) 
        });
        const result = await response.json();
        
        chatBox.removeChild(document.getElementById(loadingId));

        if (result.success) {
            appendMessage('ai', result.response, true);
            // Добавляем ответ ИИ в память, чтобы он помнил, что сам же и сказал
            chatHistory.push({ role: "assistant", content: result.response });
        } else {
            appendMessage('ai', '❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            // Если ошибка, удаляем последний вопрос из памяти, чтобы не ломать контекст
            chatHistory.pop(); 
        }
    } catch (e) {
        chatBox.removeChild(document.getElementById(loadingId));
        appendMessage('ai', '🌐 Ошибка сети.');
        chatHistory.pop();
    } finally {
        sendBtn.disabled = false;
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
