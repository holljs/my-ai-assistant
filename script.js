// Глобальные переменные
let USER_ID = null;
const API_URL = 'https://neuro-master.online/api/my_personal_ai';
const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const modelSelector = document.getElementById('modelSelector');

// Инициализация приложения
async function initApp() {
  try {
    // Инициализация VK Bridge (ваша проверенная методология)
    await vkBridge.send('VKWebAppInit', { history: false });
    
    // Получение данных пользователя
    const userInfo = await vkBridge.send('VKWebAppGetUserInfo');
    USER_ID = userInfo.id;
    loadHistory();
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    
    // Фаллбэк для мобильных (через 2 секунды)
    setTimeout(() => {
      initApp();
    }, 2000);
  }
}

// Загрузка истории чата
async function loadHistory() {
  try {
    // Защита от CSRF/IDOR (ваша важная проверка)
    const sign = window.location.search.slice(1);
    const response = await fetch(`${API_URL}/history?user_id=${USER_ID}&vk_sign=${sign}`);
    
    const data = await response.json();
    renderHistory(data);
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
  }
}

// Отправка сообщения
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  if (!USER_ID) { 
    alert("Подождите, ваш VK ID еще не загрузился.");
    return;
  }

  // Добавление сообщения пользователя
  appendMessage('user', text);
  userInput.value = '';
  sendBtn.disabled = true;

  // Индикатор загрузки
  const loadingId = `loading-${Date.now()}`;
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message ai-message';
  loadingDiv.id = loadingId;
  loadingDiv.textContent = 'Думаю... ⏳';
  chatBox.appendChild(loadingDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    // Отправка запроса на сервер
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-VK-Sign': window.location.search.slice(1) // Критичная защита
      },
      body: JSON.stringify({ 
        user_id: USER_ID, 
        prompt: text, 
        model_type: modelSelector.value 
      })
    });

    const result = await response.json();
    
    // Удаление индикатора загрузки
    document.getElementById(loadingId).remove();

    if (result.success) {
      appendMessage('ai', result.response, true);
    } else {
      appendMessage('ai', '❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (e) {
    document.getElementById(loadingId).remove();
    appendMessage('ai', '🌐 Ошибка сети.');
  } finally {
    sendBtn.disabled = false;
  }
}

// Очистка истории
clearChatBtn.addEventListener('click', async () => {
  if (!USER_ID) return;
  
  chatBox.innerHTML = '<div class="message ai-message">Очищаю память... ⏳</div>';
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-VK-Sign': window.location.search.slice(1) // Критичная защита
      },
      body: JSON.stringify({ 
        user_id: USER_ID, 
        prompt: "", 
        clear_history: true 
      })
    });
    
    const result = await response.json();
    chatBox.innerHTML = `<div class="message ai-message">${result.response}</div>`;
  } catch(e) {
    chatBox.innerHTML = '<div class="message ai-message">❌ Ошибка очистки.</div>';
  }
});

// Вспомогательные функции (ваши рабочие методы)
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

// Сохранение состояния при закрытии
function saveState() {
  localStorage.setItem('appState', JSON.stringify({
    lastMessage: Date.now(),
    modelType: modelSelector.value
  }));
}

// Обработчики событий
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
window.addEventListener('pagehide', saveState);

// Запуск при загрузке документа
document.addEventListener('DOMContentLoaded', initApp);
