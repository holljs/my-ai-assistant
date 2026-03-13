// script.js (полная рабочая версия)

// Глобальные переменные
let USER_ID = null;
let vkBridgeInitialized = false;

// Инициализация VK Bridge
function initVKBridge() {
  // 1. Подписка на события (РАБОЧИЙ ВАРИАНТ ДЛЯ ВСЕХ ПЛАТФОРМ)
  vkBridge.subscribe(e => {
    if (e.detail.type === 'VKWebAppInitResult') {
      console.log('Приложение инициализировано!');
      vkBridgeInitialized = true;
      
      // Получаем данные пользователя
      vkBridge.send('VKWebAppGetUserInfo').then(data => {
        USER_ID = data.id;
        loadHistory();
      });
    }
    
    // Обработка ошибок инициализации
    if (e.detail.type === 'VKWebAppInitError') {
      console.error('Ошибка инициализации:', e.detail.data);
    }
  });

  // 2. Фаллбэк для мобильных устройств
  setTimeout(() => {
    if (!vkBridgeInitialized) {
      console.warn('Инициализация по таймеру');
      initApp();
      vkBridgeInitialized = true;
    }
  }, 2000);
}

// Загрузка истории чата
async function loadHistory() {
  try {
    // Важный момент: защита от CSRF/IDOR
    const sign = window.location.search.slice(1);
    const response = await fetch('/api/get_history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VK-Sign': sign  // Критичный заголовок для валидации
      },
      body: JSON.stringify({ user_id: USER_ID })
    });
    
    const data = await response.json();
    renderHistory(data);
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
  }
}

// Сохранение состояния при закрытии
function saveState() {
  localStorage.setItem('appState', JSON.stringify({
    lastMessage: Date.now()
  }));
}

// Основная инициализация приложения
function initApp() {
  // Проверка наличия VK Bridge
  if (window.vkBridge) {
    initVKBridge();
  } else {
    // Загрузка через скрипт
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js';
    script.onload = initVKBridge;
    document.head.appendChild(script);
  }
}

// Обработчик закрытия/перезагрузки страницы
window.addEventListener('pagehide', () => {
  saveState();
});

// Запуск при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
