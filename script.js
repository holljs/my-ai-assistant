let USER_ID = null;
let currentFileUrl = null;
const BASE_URL = 'https://neuro-master.online/api/bro';

// Фикс для мобилок: берем параметры и из search, и из hash
const rawQueryString = (window.location.search || window.location.hash.replace('#', '?')).replace('?', '');

if (!rawQueryString) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Параметры запуска ВК не найдены!");
}

// Возвращаем старый рабочий заголовок
const headersWithSign = { 'x-vk-sign': rawQueryString };
const jsonHeadersWithSign = { 
    'Content-Type': 'application/json', 
    'x-vk-sign': rawQueryString 
};

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

// --- ОТОБРАЖЕНИЕ СООБЩЕНИЙ С КНОПКОЙ КОПИРОВАНИЯ ---
function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    
    // Добавляем текст или форматирование
    if (isMarkdown) { 
        div.innerHTML = marked.parse(text); 
    } else { 
        div.textContent = text; 
    }

    // ДОБАВЛЯЕМ КНОПКУ "СКОПИРОВАТЬ" ТОЛЬКО ДЛЯ ОТВЕТОВ ИИ
    // Проверяем, что это ИИ и это не временное сообщение с песочными часами
    if (sender === 'ai' && !text.includes('⏳') && !text.includes('Привет! Я твой НейроБро') && !text.includes('❌')) {
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '📋 Скопировать';
        // Делаем кнопку стильной и аккуратной
        copyBtn.style.cssText = 'display: block; margin-top: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: Montserrat, sans-serif; transition: all 0.2s;';
        
        copyBtn.onclick = () => {
            // Копируем исходный чистый текст
            navigator.clipboard.writeText(text).then(() => {
                // Красивая анимация успеха
                copyBtn.innerHTML = '✅ Скопировано!';
                copyBtn.style.background = 'rgba(74, 222, 128, 0.15)';
                copyBtn.style.color = '#4ade80';
                copyBtn.style.borderColor = '#4ade80';
                
                // Возвращаем кнопку в исходное состояние через 2 секунды
                setTimeout(() => {
                    copyBtn.innerHTML = '📋 Скопировать';
                    copyBtn.style.background = 'rgba(255,255,255,0.1)';
                    copyBtn.style.color = '#cbd5e1';
                    copyBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                }, 2000);
            }).catch(() => {
                alert("Не удалось скопировать. Разрешите доступ к буферу обмена.");
            });
        };
        
        div.appendChild(copyBtn);
    }

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- ИСТОРИЯ И ЭНЕРГИЯ ---
async function loadHistory() {
    if (!USER_ID) return;
    try {
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
    } catch (e) { console.error("Ошибка истории", e); }
}

async function fetchEnergy() {
    if (!USER_ID) return;
    try {
        const response = await fetch(`${BASE_URL}/user/${USER_ID}?t=${Date.now()}`, { 
            headers: headersWithSign,
            cache: 'no-store'
        });
        const result = await response.json();
        if (result.success && result.energy !== undefined) {
            energyCount.textContent = result.energy;
        } else {
            energyCount.textContent = "0";
        }
    } catch (e) { console.error("Ошибка энергии", e); }
}

// --- ЛОГИКА ТАРИФОВ И ЮKASSA ---
const energyDisplay = document.getElementById('energyDisplay');
const tariffModal = document.getElementById('tariffModal');
const closeModal = document.getElementById('closeModal');
const tariffCards = document.querySelectorAll('.tariff-card');

energyDisplay.addEventListener('click', () => {
    if (!USER_ID) return;

    // Проверяем, сидит ли юзер с мобилки
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        // Полная тишина. ВК запрещает упоминать пополнение с телефона.
        // Поэтому мы просто выходим из функции, ничего не открывая и ничего не сообщая.
        return; 
    }

    // Если это ПК - спокойно открываем тарифы
    tariffModal.style.display = 'flex';
});

closeModal.addEventListener('click', () => { tariffModal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === tariffModal) tariffModal.style.display = 'none'; });

tariffCards.forEach(card => {
    card.addEventListener('click', async () => {
        const amount = parseInt(card.getAttribute('data-amount'));
        const originalContent = card.innerHTML;
        card.innerHTML = '⏳';
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
                vkBridge.send("VKWebAppOpenUrl", {"url": result.payment_url}).catch(() => {
                    window.open(result.payment_url, '_blank');
                });
                tariffModal.style.display = 'none';
            }
            card.innerHTML = originalContent;
        } catch (e) { card.innerHTML = originalContent; }
    });
});

// --- ОЧИСТКА ПАМЯТИ ---
clearChatBtn.addEventListener('click', async () => {
    if (!USER_ID) return;
    chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
    try {
        const response = await fetch(`${BASE_URL}/chat/clear`, {
            method: 'POST',
            headers: jsonHeadersWithSign,
            body: JSON.stringify({ user_id: USER_ID, prompt: "" }) 
        });
        const result = await response.json();
        chatBox.innerHTML = `<div class="message ai-message">${result.response}</div>`;
    } catch(e) { chatBox.innerHTML = '❌ Ошибка'; }
});

// --- ПРИКРЕПЛЕНИЕ ФОТО ---
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 🧹 МАГИЧЕСКАЯ СТРОЧКА: сбрасываем инпут, чтобы скрепка не "зависала"
    fileInput.value = ''; 

    appendMessage('ai', `⏳ Загружаю фото...`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', USER_ID);

    try {
        const response = await fetch(`${BASE_URL}/upload`, { 
            method: 'POST', 
            headers: headersWithSign,
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            currentFileUrl = result.url;
            // Убираем часики и пишем, что загружено
            const messages = chatBox.querySelectorAll('.ai-message');
            const lastMessage = messages[messages.length - 1];
            if(lastMessage && lastMessage.textContent.includes('Загружаю фото')) {
                lastMessage.remove();
            }
            appendMessage('ai', `✅ Фото загружено! Теперь напиши свой вопрос к нему.`);
        } else {
            appendMessage('ai', `❌ Ошибка: ` + result.error);
        }
    } catch (e) { appendMessage('ai', `🌐 Ошибка сети при загрузке.`); }
});

// --- ОТПРАВКА СООБЩЕНИЯ ---
async function sendMessage() {
    if (sendBtn.disabled) return;
    const text = userInput.value.trim();
    if (!text && !currentFileUrl) return;
    
    appendMessage('user', text || "Анализ фото");
    userInput.value = '';
    sendBtn.disabled = true;
    userInput.disabled = true;

    const loadingId = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai-message';
    loadingDiv.id = loadingId;
    loadingDiv.textContent = 'Думаю... ⏳';
    chatBox.appendChild(loadingDiv);

    try {
        const response = await fetch(`${BASE_URL}/chat`, {
            method: 'POST',
            headers: jsonHeadersWithSign,
            body: JSON.stringify({ 
                user_id: USER_ID, 
                prompt: text || "Опиши фото", 
                model_type: modelSelector.value,
                persona: personaSelector.value,
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
            appendMessage('ai', '❌ ' + (result.error || 'Ошибка'));
        }
    } catch (e) {
        if(document.getElementById(loadingId)) document.getElementById(loadingId).remove();
        appendMessage('ai', '🌐 Ошибка сети.');
    } finally {
        sendBtn.disabled = false;
        userInput.disabled = false;
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// --- ГОЛОСОВОЙ ВВОД ---
const micBtn = document.getElementById('micBtn');

// Проверяем, поддерживает ли браузер/телефон распознавание речи
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; // Распознаем русскую речь
    recognition.interimResults = false; // Ждем, пока юзер договорит

    micBtn.addEventListener('click', () => {
        try {
            recognition.start();
            micBtn.style.color = '#ff4757'; // Красим микрофон в красный, пока слушаем
            userInput.placeholder = "Слушаю вас...";
        } catch (e) {
            // Если уже слушает - ничего не делаем
        }
    });

    recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        // Добавляем сказанное в поле ввода
        userInput.value += (userInput.value ? ' ' : '') + transcript;
    });

    recognition.addEventListener('end', () => {
        // Возвращаем обычный цвет и текст
        micBtn.style.color = ''; 
        userInput.placeholder = "Спроси меня о чем угодно...";
    });

    recognition.addEventListener('error', (e) => {
        console.error('Ошибка микрофона:', e.error);
        micBtn.style.color = '';
        userInput.placeholder = "Спроси меня о чем угодно...";
        
        if (e.error === 'not-allowed') {
            alert("Разрешите доступ к микрофону в настройках браузера или ВК!");
        }
    });
} else {
    // Если это совсем старый браузер или iPhone с ограничениями
    micBtn.addEventListener('click', () => {
        alert("К сожалению, ваше устройство или браузер не поддерживает голосовой ввод. 😔");
    });
}

// --- ЗАПУСК ---
async function initApp() {
    try {
        const data = await vkBridge.send('VKWebAppGetUserInfo');
        if (data && data.id) {
            USER_ID = data.id;
            loadHistory();
            fetchEnergy();
        }
    } catch (e) { setTimeout(initApp, 2000); }
}

// --- КРАСИВАЯ СПРАВКА ПО МОДЕЛЯМ ---
const helpModelsBtn = document.getElementById('helpModelsBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpModal = document.getElementById('closeHelpModal');

if (helpModelsBtn && helpModal) {
    // Открываем модалку
    helpModelsBtn.addEventListener('click', () => {
        helpModal.style.display = 'flex';
    });
    
    // Закрываем по крестику
    closeHelpModal.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    
    // Закрываем по клику мимо окна
    window.addEventListener('click', (e) => { 
        if (e.target === helpModal) helpModal.style.display = 'none'; 
    });
}

vkBridge.send('VKWebAppInit').then(() => initApp());
