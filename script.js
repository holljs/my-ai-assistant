let USER_ID = null;
let currentFileUrl = null;
const BASE_URL = 'https://neuro-master.online/api/bro';

// Настройки разметки Markdown для ответов с кодом
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
const energyCount = document.getElementById('energyCount');

// --- ОТОБРАЖЕНИЕ СООБЩЕНИЙ ---
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

// --- ИСТОРИЯ И ЭНЕРГИЯ ---
async function loadHistory() {
    try {
        const response = await fetch('${BASE_URL}/history?user_id=${USER_ID}')
        const result = await response.json();
        if (result.success && result.history.length > 0) {
            chatBox.innerHTML = ''; 
            result.history.forEach(msg => {
                appendMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, msg.role !== 'user');
            });
        }
    } catch (e) { console.error("Ошибка загрузки истории", e); }
}

async function fetchEnergy() {
    if (!USER_ID) return;
    try {
        const response = await fetch('${BASE_URL}/user/${USER_ID}')
        const result = await response.json();
        if (result.success && result.energy !== undefined) {
            energyCount.textContent = result.energy;
        }
    } catch (e) { console.error("Ошибка загрузки энергии", e); }
}

// --- ОПЛАТА И ПЛАТФОРМА (ЮKASSA) ---
const payBtn = document.getElementById('payBtn');
const urlParams = new URLSearchParams(window.location.search);
const vkPlatform = urlParams.get('vk_platform');

// Прячем оплату на мобилках
if (vkPlatform === 'mobile_iphone' || vkPlatform === 'mobile_android' || vkPlatform === 'mobile_ipad') {
    if (payBtn) payBtn.style.display = 'none';
} else {
    if (payBtn) payBtn.style.display = 'block';
    
    payBtn.addEventListener('click', async () => {
        if (!USER_ID) return alert("Подождите, ID еще загружается...");
        
        payBtn.textContent = "⏳...";
        payBtn.disabled = true;

        try {
            const response = await fetch('https://neuro-master.online/api/yookassa/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    amount: 150, 
                    description: "Пополнение баланса НейроБро (1500 ⚡️)",
                    platform: "vk"
                })
            });
            const result = await response.json();
            if (result.success && result.payment_url) {
                window.location.href = result.payment_url;
            } else {
                alert("❌ Ошибка кассы: " + (result.detail || "Неизвестно"));
                payBtn.textContent = "💳 150₽";
                payBtn.disabled = false;
            }
        } catch (e) {
            alert("🌐 Ошибка сети при платеже.");
            payBtn.textContent = "💳 150₽";
            payBtn.disabled = false;
        }
    });
}

// --- ГОЛОСОВОЙ ВВОД (Микрофон) ---
const micBtn = document.getElementById('micBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;

    micBtn.addEventListener('click', () => {
        try {
            recognition.start();
            micBtn.classList.add('recording');
            userInput.placeholder = "Слушаю вас...";
        } catch (e) { console.log("Запись уже идет."); }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript; 
        micBtn.classList.remove('recording');
        userInput.placeholder = "Спроси меня о чем угодно...";
    };

    recognition.onspeechend = () => {
        recognition.stop();
        micBtn.classList.remove('recording');
        userInput.placeholder = "Спроси меня о чем угодно...";
    };

    recognition.onerror = (event) => {
        micBtn.classList.remove('recording');
        userInput.placeholder = "Спроси меня о чем угодно...";
        if (event.error !== 'no-speech') alert("Ошибка микрофона. Проверьте разрешения в ВК.");
    };
} else {
    micBtn.style.display = 'none'; // Скрываем, если устройство не поддерживает
}

// --- ОЧИСТКА ПАМЯТИ ---
clearChatBtn.addEventListener('click', async () => {
    if (!USER_ID) return;
    chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
    try {
        const response = await fetch('${BASE_URL}/chat', ...)
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: USER_ID, prompt: "", clear_history: true }) 
        });
        const result = await response.json();
        chatBox.innerHTML = `<div class="message ai-message">${result.response}</div>`;
    } catch(e) { chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка очистки.</div>'; }
});

// --- ПРИКРЕПЛЕНИЕ ФОТО ---
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    appendMessage('ai', `⏳ Загружаю фото...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('https://neuro-master.online/api/upload', {
            method: 'POST', body: formData
        });
        const result = await response.json();
        if (result.success) {
            currentFileUrl = result.url;
            appendMessage('ai', `✅ Фото прикреплено. Напиши, что с ним сделать (включи режим Вижн)!`);
        } else {
            appendMessage('ai', `❌ Ошибка загрузки файла.`);
        }
    } catch (e) { appendMessage('ai', `🌐 Ошибка сети при отправке файла.`); }
});

// --- ОТПРАВКА СООБЩЕНИЯ ---
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentFileUrl) return; 
    if (!USER_ID) return alert("Подождите, ваш VK ID еще не загрузился.");

    appendMessage('user', text || "Анализ фото");
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
                prompt: text || "Опиши фото", 
                model_type: modelSelector.value,
                attachments: currentFileUrl ? [currentFileUrl] : []
            }) 
        });
        const result = await response.json();
        
        document.getElementById(loadingId).remove();
        currentFileUrl = null; 

        if (result.success) {
            appendMessage('ai', result.response, true);
            fetchEnergy(); // <--- Обновляем баланс энергии после успешного ответа!
        } else {
            appendMessage('ai', '❌ ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (e) {
        if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
        appendMessage('ai', '🌐 Ошибка сети. Проверьте интернет.');
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

// --- ЗАПУСК ПРИЛОЖЕНИЯ (Правильная инициализация ВК) ---
async function initApp() {
    const idFromUrl = urlParams.get('vk_user_id');
    
    if (idFromUrl) {
        USER_ID = parseInt(idFromUrl);
        loadHistory();
        fetchEnergy(); // Грузим энергию
        return; 
    }

    try {
        const data = await vkBridge.send('VKWebAppGetUserInfo');
        if (data && data.id) {
            USER_ID = data.id;
            loadHistory();
            fetchEnergy(); // Грузим энергию
        }
    } catch (e) {
        console.error("Ошибка получения юзера через Bridge:", e);
        setTimeout(initApp, 2000);
    }
}

vkBridge.send('VKWebAppInit')
    .then(() => initApp())
    .catch(() => initApp());
