let USER_ID = null;
let currentFileUrl = null;
const BASE_URL = 'https://neuro-master.online/api/bro';

// --- КРИТИЧЕСКИ ВАЖНО ДЛЯ БЕЗОПАСНОСТИ (ЗАЩИТА ОТ IDOR) ---
// Собираем цифровую подпись ВКонтакте из адресной строки
const vkSign = window.location.search.substring(1); 
const headersWithSign = { 'x-vk-sign': vkSign };
const jsonHeadersWithSign = { 'Content-Type': 'application/json', 'x-vk-sign': vkSign };

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
const personaSelector = document.getElementById('personaSelector');
const energyCount = document.getElementById('energyCount');

// --- ОТОБРАЖЕНИЕ СООБЩЕНИЙ ---
function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    if (isMarkdown) { div.innerHTML = marked.parse(text); } 
    else { div.textContent = text; }
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- ИСТОРИЯ И ЭНЕРГИЯ ---
async function loadHistory() {
    try {
        // Добавляем параметр t с текущим временем и cache: 'no-store', чтобы убить кэширование
        const response = await fetch(`${BASE_URL}/history?user_id=${USER_ID}&t=${Date.now()}`, { 
            headers: headersWithSign,
            cache: 'no-store' 
        });
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
        const response = await fetch(`${BASE_URL}/user/${USER_ID}`, { headers: headersWithSign });
        const result = await response.json();
        if (result.success && result.energy !== undefined) {
            energyCount.textContent = result.energy;
        }
    } catch (e) { console.error("Ошибка загрузки энергии", e); }
}

// --- ЛОГИКА ТАРИФОВ И ЮKASSA ---
const energyDisplay = document.getElementById('energyDisplay');
const addEnergyIcon = document.getElementById('addEnergyIcon');
const tariffModal = document.getElementById('tariffModal');
const closeModal = document.getElementById('closeModal');
const tariffCards = document.querySelectorAll('.tariff-card');

const urlParams = new URLSearchParams(window.location.search);
const vkPlatform = urlParams.get('vk_platform');

// На мобилках просто скрываем плюсик, но логику клика оставляем ДЛЯ ВСЕХ УСТРОЙСТВ!
if (vkPlatform === 'mobile_iphone' || vkPlatform === 'mobile_android' || vkPlatform === 'mobile_ipad') {
    if (addEnergyIcon) addEnergyIcon.style.display = 'none';
}

// Привязываем клик к балансу безусловно (исправление бага на MacOS/PC)
energyDisplay.classList.add('clickable-energy');
energyDisplay.addEventListener('click', () => {
    if (!USER_ID) return alert("Подождите, ID еще загружается...");
    tariffModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => { tariffModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === tariffModal) tariffModal.style.display = 'none'; });

tariffCards.forEach(card => {
    card.addEventListener('click', async () => {
        const amount = parseInt(card.getAttribute('data-amount'));
        const originalContent = card.innerHTML;
        card.innerHTML = '<span style="margin: 0 auto; font-weight:bold;">Загрузка... ⏳</span>';
        
        try {
            const response = await fetch('https://neuro-master.online/api/yookassa/create-payment', {
                method: 'POST',
                headers: jsonHeadersWithSign,
                body: JSON.stringify({
                    user_id: USER_ID, amount: amount, 
                    description: `Пополнение Энергии НейроБро`,
                    platform: "vk", currency_type: "energy"
                })
            });
            const result = await response.json();
            
            if (result.success && result.payment_url) {
                try {
                    await vkBridge.send("VKWebAppOpenUrl", {"url": result.payment_url});
                } catch (bridgeError) {
                    window.open(result.payment_url, '_blank');
                }
                card.innerHTML = originalContent;
                tariffModal.style.display = 'none';
            } else {
                alert("❌ Ошибка кассы: " + (result.detail || "Неизвестно"));
                card.innerHTML = originalContent;
            }
        } catch (e) {
            alert("🌐 Ошибка сети при платеже.");
            card.innerHTML = originalContent;
        }
    });
});

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
        } catch (e) { console.log("Запись уже идет или заблокирована браузером."); }
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
        if (event.error !== 'no-speech') {
            console.error("Mic error:", event.error);
            alert("Ошибка доступа к микрофону. Разрешите доступ в настройках браузера.");
        }
    };
} else {
    micBtn.style.display = 'none';
}

// --- ОЧИСТКА ПАМЯТИ (ИСПРАВЛЕНО ПОД НОВЫЙ МЕТОД) ---
clearChatBtn.addEventListener('click', async () => {
    if (!USER_ID) return;
    
    // Визуальный фидбек для юзера
    chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/chat/clear`, {
            method: 'POST',
            headers: jsonHeadersWithSign,
            body: JSON.stringify({ 
                user_id: USER_ID, 
                prompt: "" // Для очистки текст не нужен, но схема требует
            }) 
        });
        const result = await response.json();
        
        if (result.success) {
            chatBox.innerHTML = `<div class="message ai-message">${result.response}</div>`;
        } else {
            chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка очистки на сервере.</div>';
        }
    } catch(e) { 
        console.error(e);
        chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка сети при очистке.</div>'; 
    }
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
            method: 'POST', 
            headers: headersWithSign, // Передаем подпись для загрузки файлов
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            currentFileUrl = result.url;
            appendMessage('ai', `✅ Фото загружено. Напиши, что с ним сделать (включи режим Думающая)!`);
        } else {
            appendMessage('ai', `❌ Ошибка загрузки файла.`);
        }
    } catch (e) { appendMessage('ai', `🌐 Ошибка сети при отправке файла.`); }
});

// --- ОТПРАВКА СООБЩЕНИЯ (Исправлен баг со спамом) ---
async function sendMessage() {
    if (sendBtn.disabled) return; // ЖЕСТКАЯ БЛОКИРОВКА ОТ СПАМА
    
    const text = userInput.value.trim();
    if (!text && !currentFileUrl) return; 
    if (!USER_ID) return alert("Подождите, ваш VK ID еще не загрузился.");

    appendMessage('user', text || "Анализ фото");
    userInput.value = '';
    
    // Отключаем ввод на время генерации ответа
    sendBtn.disabled = true;
    userInput.disabled = true; 

    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.id = loadingId;
    loadingDiv.textContent = 'Думаю... ⏳';
    chatBox.appendChild(loadingDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const response = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: jsonHeadersWithSign,
            body: JSON.stringify({ 
                user_id: USER_ID, 
                prompt: text || "Опиши фото", 
                model_type: modelSelector.value,
                persona: personaSelector.value, // ПЕРЕДАЕМ ВЫБРАННУЮ РОЛЬ
                attachments: currentFileUrl ? [currentFileUrl] : []
            }) 
        });
        const result = await response.json();
        
        if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
        currentFileUrl = null; 

        if (result.success) {
            appendMessage('ai', result.response, true);
            fetchEnergy();
        } else {
            appendMessage('ai', '❌ ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (e) {
        if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
        appendMessage('ai', '🌐 Ошибка сети. Проверьте интернет.');
    } finally {
        // Возвращаем активность полям
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
async function initApp() {
    const idFromUrl = urlParams.get('vk_user_id');
    
    if (idFromUrl) {
        USER_ID = parseInt(idFromUrl);
        loadHistory();
        fetchEnergy();
        return; 
    }

    try {
        const data = await vkBridge.send('VKWebAppGetUserInfo');
        if (data && data.id) {
            USER_ID = data.id;
            loadHistory();
            fetchEnergy();
        }
    } catch (e) {
        console.error("Ошибка Bridge:", e);
        setTimeout(initApp, 2000);
    }
}

vkBridge.send('VKWebAppInit').then(() => initApp()).catch(() => initApp());
