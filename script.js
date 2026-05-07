let USER_ID = null;
let currentFileUrl = null;
const BASE_URL = 'https://neuro-master.online/api/bro';

const rawQueryString = (window.location.search || window.location.hash.replace('#', '?')).replace('?', '');

if (!rawQueryString) {
    console.error("❌ КРИТИЧЕСКАЯ ОШИБКА: Параметры запуска ВК не найдены!");
}

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

// --- ОТОБРАЖЕНИЕ СООБЩЕНИЙ ---
function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    
    if (isMarkdown) { 
        div.innerHTML = marked.parse(text); 
    } else { 
        div.textContent = text; 
    }

    if (sender === 'ai' && !text.includes('⏳') && !text.includes('Привет! Я твой НейроБро') && !text.includes('❌') && !text.includes('Фото загружено')) {
        const copyBtn = document.createElement('button');
        copyBtn.innerHTML = '📋 Скопировать';
        copyBtn.style.cssText = 'display: block; margin-top: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: Montserrat, sans-serif; transition: all 0.2s;';
        
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '✅ Скопировано!';
                copyBtn.style.background = 'rgba(74, 222, 128, 0.15)';
                copyBtn.style.color = '#4ade80';
                copyBtn.style.borderColor = '#4ade80';
                
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

// --- ТАРИФЫ И ЮKASSA ---
const energyDisplay = document.getElementById('energyDisplay');
const tariffModal = document.getElementById('tariffModal');
const closeModal = document.getElementById('closeModal');
const tariffCards = document.querySelectorAll('.tariff-card');

energyDisplay.addEventListener('click', () => {
    if (!USER_ID) return;
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return; 
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
const confirmModal = document.getElementById('confirmModal');
const cancelClearBtn = document.getElementById('cancelClearBtn');
const confirmClearBtn = document.getElementById('confirmClearBtn');

// 1. Показываем красивое окно при клике на корзину
clearChatBtn.addEventListener('click', () => {
    if (!USER_ID) return;
    confirmModal.style.display = 'flex'; 
});

// 2. Если нажали "Отмена" - прячем окно
cancelClearBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none';
});

// 3. Если нажали "Удалить" - стираем память
confirmClearBtn.addEventListener('click', async () => {
    confirmModal.style.display = 'none'; // Сразу прячем окно
    
    chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
    try {
        const response = await fetch(`${BASE_URL}/chat/clear`, {
            method: 'POST',
            headers: jsonHeadersWithSign,
            body: JSON.stringify({ user_id: USER_ID, prompt: "" }) 
        });
        const result = await response.json();
        chatBox.innerHTML = `<div class="message ai-message">${result.response || 'Память очищена! 🧹'}</div>`;
    } catch(e) { 
        chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка очистки</div>'; 
    }
});

// --- ПРИКРЕПЛЕНИЕ ФОТО ---
const fileInput = document.getElementById('fileInput');
const attachBtn = document.getElementById('attachBtn');
attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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
        
        const messages = chatBox.querySelectorAll('.ai-message');
        const lastMessage = messages[messages.length - 1];
        if(lastMessage && lastMessage.textContent.includes('Загружаю фото')) {
            lastMessage.remove();
        }
        
        if (result.success) {
            currentFileUrl = result.url;
            const imgHtml = `<img src="${currentFileUrl}" style="max-width: 100%; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"><br><b>✅ Фото загружено!</b> Теперь напиши свой вопрос к нему.`;
            appendMessage('ai', imgHtml, true); 
        } else {
            // Читаем правильный текст ошибки с сервера
            const err = result.detail || result.error || 'Неверный формат или размер файла.';
            appendMessage('ai', `❌ Ошибка: ` + err);
        }
    } catch (e) { 
        appendMessage('ai', `🌐 Ошибка сети при загрузке.`); 
    }
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

        // Если сервер вернул success == true
        if (response.ok && result.success !== false) {
            appendMessage('ai', result.response, true);
            fetchEnergy();
        } else {
            // Читаем ошибку из detail (это стандарт FastAPI)
            const errorMsg = result.detail || result.error || 'Неизвестная ошибка сервера';
            appendMessage('ai', '❌ ' + errorMsg);
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

// ИСПРАВЛЕНИЕ: Enter переносит строку на мобилке
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
        if (window.innerWidth <= 768) {
            return; // На телефоне ничего не блокируем, строка перенесется сама
        }
        // На компьютере блокируем перенос и отправляем
        e.preventDefault(); 
        sendMessage(); 
    }
});

// --- ГОЛОСОВОЙ ВВОД ---
const micBtn = document.getElementById('micBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU'; 
    recognition.interimResults = false; 

    micBtn.addEventListener('click', () => {
        try {
            recognition.start();
            micBtn.style.color = '#ff4757'; 
            userInput.placeholder = "Слушаю вас...";
        } catch (e) { }
    });

    recognition.addEventListener('result', (e) => {
        const transcript = e.results[0][0].transcript;
        userInput.value += (userInput.value ? ' ' : '') + transcript;
    });

    recognition.addEventListener('end', () => {
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
    micBtn.addEventListener('click', () => {
        alert("К сожалению, ваше устройство или браузер не поддерживает голосовой ввод. 😔");
    });
}

// --- СПРАВКА ПО МОДЕЛЯМ ---
const helpModelsBtn = document.getElementById('helpModelsBtn');
const helpModal = document.getElementById('helpModal');
const closeHelpModal = document.getElementById('closeHelpModal');

if (helpModelsBtn && helpModal) {
    helpModelsBtn.addEventListener('click', () => helpModal.style.display = 'flex');
    closeHelpModal.addEventListener('click', () => helpModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.style.display = 'none'; });
}

// --- ПЕРЕХВАТ ССЫЛОК И КНОПОК ВК (ИСПРАВЛЕНИЕ БАГОВ) ---

// Перехват обычных ссылок в тексте (чтобы не было серого экрана)
chatBox.addEventListener('click', (e) => {
    let link = e.target.closest('a');
    if (link && link.href) {
        e.preventDefault();
        if (link.href.includes('app54451681')) {
            vkBridge.send("VKWebAppOpenApp", { app_id: 54451681 });
        } else {
            vkBridge.send("VKWebAppOpenLink", { url: link.href });
        }
    }
});

// Кнопка "Написать в сообщество"
const btnCommunity = document.getElementById('btnCommunity');
if (btnCommunity) {
    btnCommunity.addEventListener('click', (e) => {
        e.preventDefault();
        const groupId = 191367447; 
        
        // Попытка 1: Мобильный виджет ВК
        vkBridge.send("VKWebAppShowCommunityMessages", { group_id: groupId })
            .catch(() => {
                // Попытка 2: Мобильная ссылка ВК
                vkBridge.send("VKWebAppOpenLink", { url: `https://vk.com/im?sel=-${groupId}` })
                    .catch(() => {
                        // Попытка 3: Безотказный метод для КОМПЬЮТЕРА
                        window.open(`https://vk.com/im?sel=-${groupId}`, '_blank');
                    });
            });
    });
}

// Кнопка "Написать Наталье"
const btnNatalia = document.getElementById('btnNatalia');
if (btnNatalia) {
    btnNatalia.addEventListener('click', (e) => {
        e.preventDefault();
        const url = "https://vk.com/nataliselyahova";
        
        // Попытка 1: Мобильная ссылка ВК
        vkBridge.send("VKWebAppOpenLink", { url: url })
            .catch(() => {
                // Попытка 2: Безотказный метод для КОМПЬЮТЕРА
                window.open(url, '_blank');
            });
    });
}

// --- СОХРАНЕНИЕ ВЫБОРА РЕЖИМА ---
// Загружаем сохраненные настройки при входе
if (localStorage.getItem('bro_model')) {
    modelSelector.value = localStorage.getItem('bro_model');
}
if (localStorage.getItem('bro_persona')) {
    personaSelector.value = localStorage.getItem('bro_persona');
}

// Сохраняем, когда юзер что-то меняет
modelSelector.addEventListener('change', (e) => localStorage.setItem('bro_model', e.target.value));
personaSelector.addEventListener('change', (e) => localStorage.setItem('bro_persona', e.target.value));

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

vkBridge.send('VKWebAppInit').then(() => initApp());
