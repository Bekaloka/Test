// This is the main JavaScript file for the reactor simulation game.
// It will contain the game logic and interface interactions.

// Глобальные константы для условий
const OVERHEAT_THRESHOLD = 800; // Градусы Цельсия
const COLD_THRESHOLD = 200;     // Градусы Цельсия
const MELTDOWN_THRESHOLD = OVERHEAT_THRESHOLD + 100; // Температура полного расплава
const TARGET_STABLE_TICKS = 60; // Цель: 60 тиков стабильной работы (1 минута)
const POWER_TARGET_MW = 200;    // Целевая мощность для победы
const MAX_OVERHEAT_DURATION = 15; // Максимальное время в состоянии перегрева до проигрыша

// 1. Переменные состояния
let temperature = 250; // Начальная безопасная температура (градусы Цельсия)
let controlRodDepth = 50; // Начальная глубина стержней (0% - полностью подняты, 100% - полностью опущены)
let powerOutput = 10; // Начальная низкая мощность (МВт)
let reactorCondition = "Стабилен"; // Начальное состояние реактора
let gameMessage = "Добро пожаловать! Реактор запущен."; // Начальное игровое сообщение
let isGameOver = false;
let stableTicks = 0;
let overheatDuration = 0; // Счетчик тиков в состоянии перегрева

// 2. Ссылки на HTML элементы
const temperatureDisplay = document.getElementById('temperature');
const rodDepthDisplay = document.getElementById('control-rod-depth');
const powerOutputDisplay = document.getElementById('power-output');
const reactorConditionDisplay = document.getElementById('reactor-condition');
const gameMessageDisplay = document.getElementById('game-message');

// 3. Функция обновления отображения
function updateDisplay() {
    temperatureDisplay.textContent = temperature.toFixed(1); // Отображаем с одним знаком после запятой
    rodDepthDisplay.textContent = controlRodDepth.toFixed(0);
    powerOutputDisplay.textContent = powerOutput.toFixed(1);
    reactorConditionDisplay.textContent = reactorCondition;
    gameMessageDisplay.textContent = gameMessage;
}

// 4. Первоначальный вызов для отображения начальных значений
// Ссылки на кнопки
const raiseRodsBtn = document.getElementById('raise-rods-btn');
const lowerRodsBtn = document.getElementById('lower-rods-btn');

// Функции управления
function raiseRods() {
    if (isGameOver) { return; }
    controlRodDepth -= 5;
    if (controlRodDepth < 0) {
        controlRodDepth = 0;
    }
    gameMessage = "Управляющие стержни немного подняты.";
    // Логика физики будет обновлена в gameLoop
    updateDisplay(); // Обновить отображение немедленно для отклика интерфейса
}

function lowerRods() {
    if (isGameOver) { return; }
    controlRodDepth += 5;
    if (controlRodDepth > 100) {
        controlRodDepth = 100;
    }
    gameMessage = "Управляющие стержни немного опущены.";
    // Логика физики будет обновлена в gameLoop
    updateDisplay(); // Обновить отображение немедленно для отклика интерфейса
}

// Обработчики событий
raiseRodsBtn.addEventListener('click', raiseRods);
lowerRodsBtn.addEventListener('click', lowerRods);

// Настройки игрового цикла
const GAME_TICK_MS = 1000; // мс

// Функция обновления физики реактора
function updateReactorPhysics() {
    // Логика температуры
    let tempChange = 0;
    if (controlRodDepth < 100) { // Стержни не полностью опущены
        tempChange += (100 - controlRodDepth) / 100 * 0.5; // Нагрев, макс +0.5 градуса/тик
    }
    if (controlRodDepth === 100) { // Стержни полностью опущены
        tempChange -= 0.2; // Охлаждение
    }
    temperature -= 0.1; // Пассивное рассеивание тепла
    temperature += tempChange;

    if (temperature < 20) temperature = 20; // Ограничение минимальной температуры

    // Логика мощности
    if (temperature > 150 && controlRodDepth < 90) {
        powerOutput = (temperature / 10) * ((100 - controlRodDepth) / 100);
    } else {
        powerOutput = 0; // Слишком холодно или стержни слишком глубоко
    }

    if (powerOutput < 0) powerOutput = 0; // Ограничение минимальной мощности
    if (powerOutput > 1000) powerOutput = 1000; // Ограничение максимальной мощности
}

// Функция проверки условий реактора
function checkConditions() {
    // Если игра уже окончена и это состояние "расплав", то ничего не меняем, 
    // так как это самое критическое состояние и оно не должно быть перезаписано другим сообщением о конце игры.
    if (isGameOver && reactorConditionDisplay.className === 'critical' && reactorCondition === "!!! РАСПЛАВ АКТИВНОЙ ЗОНЫ !!!") {
        updateDisplay(); 
        return;
    }
    // Для других состояний game over (выигрыш, длительный перегрев), классы уже должны быть установлены.
    // Просто обновим отображение и выйдем, чтобы предотвратить сброс классов ниже.
    if (isGameOver) {
        updateDisplay();
        return;
    }

    // Сброс классов перед новой оценкой или установка по умолчанию.
    // reactorConditionDisplay.className = ''; // Будет установлено ниже
    gameMessageDisplay.className = 'message-normal'; // По умолчанию

    // 1. Смертельные условия (проигрыш)
    if (temperature >= MELTDOWN_THRESHOLD) {
        reactorCondition = "!!! РАСПЛАВ АКТИВНОЙ ЗОНЫ !!!";
        gameMessage = "КРИТИЧЕСКИЙ СБОЙ! ВЫ ПРОИГРАЛИ!";
        isGameOver = true;
        powerOutput = 0;
        temperature = MELTDOWN_THRESHOLD; // фиксируем для отображения
        
        reactorConditionDisplay.className = 'critical';
        gameMessageDisplay.className = 'message-lose';
        disableControls();
        updateDisplay(); // Обновить перед выходом
        return;
    }

    // Логика перегрева (устанавливает reactorCondition, но не всегда isGameOver)
    if (temperature >= OVERHEAT_THRESHOLD) {
        reactorCondition = "!!! ПЕРЕГРЕВ !!!";
        gameMessage = "КРИТИЧЕСКАЯ ТЕМПЕРАТУРА! РИСК РАСПЛАВА!";
        reactorConditionDisplay.className = 'warning'; // Устанавливаем класс warning
        stableTicks = 0; // Перегрев сбрасывает прогресс к победе
        overheatDuration++; // Увеличиваем счетчик тиков перегрева

        if (overheatDuration >= MAX_OVERHEAT_DURATION) {
            reactorCondition = "ПРОДОЛЖИТЕЛЬНЫЙ ПЕРЕГРЕВ! СИСТЕМЫ ОТКАЗАЛИ!";
            gameMessage = "Реактор не удалось стабилизировать. ВЫ ПРОИГРАЛИ!";
            isGameOver = true;
            // Важно: Перезаписываем класс на 'critical' для этого типа проигрыша
            reactorConditionDisplay.className = 'critical'; 
            gameMessageDisplay.className = 'message-lose';
            disableControls();
            updateDisplay(); // Обновить перед выходом
            return;
        }
    } else if (temperature < COLD_THRESHOLD) {
        reactorCondition = "Охлажден / Остановлен";
        gameMessage = "Температура слишком низкая для генерации энергии.";
        powerOutput = 0;
        stableTicks = 0;
        reactorConditionDisplay.className = ''; // Нет специального класса (или можно 'cold' если есть стиль)
        gameMessageDisplay.className = 'message-normal'; // Обычное информационное сообщение
        overheatDuration = 0; // Сброс счетчика перегрева
    } else { // Если не перегрев и не холод
        reactorCondition = "Стабилен";
        // gameMessage будет установлено ниже, при проверке победы или обычной стабильной работы
        reactorConditionDisplay.className = 'stable';
        gameMessageDisplay.className = 'message-normal'; // По умолчанию для стабильного состояния
        overheatDuration = 0; // Сброс счетчика перегрева
    }

    // 2. Условие выигрыша (только если игра еще не окончена проигрышем и реактор стабилен)
    if (reactorCondition === "Стабилен" && powerOutput >= POWER_TARGET_MW) {
        stableTicks++;
        gameMessage = `Реактор стабилен. До цели: ${TARGET_STABLE_TICKS - stableTicks} сек. Мощность: ${powerOutput.toFixed(0)} МВт`;
        // reactorConditionDisplay.className остается 'stable'
        gameMessageDisplay.className = 'message-normal'; // Обычное информационное сообщение во время отсчета

        if (stableTicks >= TARGET_STABLE_TICKS) {
            gameMessage = `ПОЗДРАВЛЯЕМ! Вы успешно обеспечивали энергию на протяжении ${TARGET_STABLE_TICKS} секунд! ВЫ ВЫИГРАЛИ!`;
            isGameOver = true;
            // reactorConditionDisplay.className остается 'stable'
            gameMessageDisplay.className = 'message-win';
            disableControls();
            updateDisplay(); // Обновить перед выходом
            return;
        }
    } else if (reactorCondition === "Стабилен") { // Стабилен, но мощность мала или другие условия победы не достигнуты
        stableTicks = 0; // Сбрасываем прогресс, если мощность упала ниже целевой
        gameMessage = `Реактор стабилен, но мощность (${powerOutput.toFixed(0)} МВт) ниже целевой (${POWER_TARGET_MW} МВт).`;
        // reactorConditionDisplay.className остается 'stable'
        gameMessageDisplay.className = 'message-normal';
    }
    
    // Если дошли сюда, игра не окончена из-за проигрыша или выигрыша в этом тике.
    // Классы и сообщения для состояний "Перегрев", "Охлажден", "Стабилен (в процессе к победе)", "Стабилен (мало мощности)"
    // уже установлены выше.
    // updateDisplay() будет вызван в gameLoop.
}


// Основной игровой цикл
function gameLoop() {
    if (isGameOver) {
        // Если игра окончена, checkConditions выше уже вызвал updateDisplay() и вышел (для большинства случаев).
        // Этот return здесь для подстраховки, чтобы gameLoop не продолжал выполняться.
        // Финальное updateDisplay() уже должно было быть вызвано в checkConditions при установке isGameOver.
        return; 
    }
    updateReactorPhysics();
    checkConditions(); // Эта функция теперь сама может вызвать updateDisplay и return при gameover
    
    if (!isGameOver) { // Если checkConditions не завершил игру (т.е. не было return из checkConditions)
        updateDisplay(); // Обновляем отображение каждый тик для обычных состояний
    }
}

// Функция для отключения кнопок управления
function disableControls() {
    raiseRodsBtn.disabled = true;
    lowerRodsBtn.disabled = true;
}

// Запуск игрового цикла
setInterval(gameLoop, GAME_TICK_MS);

updateDisplay(); // Убедитесь, что этот вызов остается, чтобы инициализировать значения
