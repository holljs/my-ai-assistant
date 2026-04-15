let USER_ID = null;
let currentFileUrl = null;
const API_URL = 'https://neuro-master.online/api/my_personal_ai';

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('userInput');
const modelSelector = document.getElementById('modelSelector');
const micBtn = document.getElementById('micBtn');

// Голосовое распознавание
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    micBtn.onclick = () => {
        recognition.start();
        micBtn.classList.add('recording');
    };
    recognition.onresult = (e) => {
        userInput.value += e.results[0][0].transcript;
        micBtn.classList.remove('recording');
    };
    recognition.onerror = () => micBtn.classList.remove('recording');
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentFileUrl) return;
    if (!USER_ID) return alert("Загрузка ID...");

    appendMessage('user', text || "Анализ фото");
    userInput.value = '';
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                user_id: USER_ID,
                prompt: text,
                model_type: modelSelector.value,
                attachments: currentFileUrl ? [currentFileUrl] : []
            })
        });
        const result = await res.json();
        if (result.success) appendMessage('ai', result.response, true);
        else appendMessage('ai', "❌ " + result.error);
    } catch (e) { appendMessage('ai', "🌐 Ошибка сети"); }
}

function appendMessage(sender, text, isMarkdown = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    div.innerHTML = isMarkdown ? marked.parse(text) : text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function initApp() {
    const urlParams = new URLSearchParams(window.location.search);
    USER_ID = urlParams.get('vk_user_id');
    if (USER_ID) USER_ID = parseInt(USER_ID);
    else {
        const data = await vkBridge.send('VKWebAppGetUserInfo');
        USER_ID = data.id;
    }
}

vkBridge.send('VKWebAppInit').then(initApp);
document.getElementById('sendBtn').onclick = sendMessage;
