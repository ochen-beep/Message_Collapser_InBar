// state.js — чистая логика управления состоянием сворачивания.
//
// Вынесена в отдельный модуль, чтобы её можно было unit-тестировать без
// загрузки SillyTavern и без мокирования DOM. Все зависимости (extension_settings,
// chat, DOM-элемент) передаются аргументами.

export const defaultSettings = Object.freeze({
    isEnabled: false,
    collapsedMessages: {},
    manuallyExpandedMessages: {},
    previewMode: 'hide',        // 'hide' | 'preview'
    previewLines: 2,
    autoCollapseByLength: false,
    lengthThreshold: 1000,
    autoCollapseByAge: false,
    ageThreshold: 20,
});

// Создаёт или дополняет объект настроек расширения дефолтными ключами.
export function buildSettings(extensionSettings, extensionName) {
    if (!extensionSettings[extensionName]) {
        extensionSettings[extensionName] = { ...defaultSettings };
    }
    const settings = extensionSettings[extensionName];
    for (const key in defaultSettings) {
        if (settings[key] === undefined) {
            settings[key] = defaultSettings[key];
        }
    }
    return settings;
}

// Возвращает стабильный ключ сообщения по его send_date.
// mesElement — DOM-узел с атрибутом mesid; chat — массив chat[i].
export function getStableMessageKey(chat, mesElement) {
    const mesId = parseInt(mesElement.getAttribute('mesid'));
    if (isNaN(mesId)) return null;
    const message = chat?.[mesId];
    const sendDate = message?.send_date;
    return sendDate ? String(sendDate) : null;
}

// Проверяет, сохранено ли сообщение как вручную свёрнутое.
export function isManuallyCollapsed(collapsedMessages, chatId, key) {
    return Boolean(key && collapsedMessages?.[chatId]?.[key]);
}

// Сохраняет или удаляет ручное состояние сворачивания одного сообщения.
// Возвращает true, если состояние действительно изменилось (вызывающий код
// отвечает за вызов saveSettingsDebounced при необходимости).
export function saveCollapsedState(settings, chatId, key, collapsed) {
    if (!chatId || !key || !settings) return false;
    if (!settings.collapsedMessages) settings.collapsedMessages = {};
    if (!settings.collapsedMessages[chatId]) settings.collapsedMessages[chatId] = {};

    const map = settings.collapsedMessages[chatId];
    let changed = false;
    if (collapsed) {
        if (!map[key]) { map[key] = true; changed = true; }
    } else {
        if (map[key]) { delete map[key]; changed = true; }
    }
    return changed;
}

// Проверяет, было ли сообщение вручную развёрнуто (для переопределения
// авто-сворачивания).
export function isManuallyExpanded(expandedMessages, chatId, key) {
    return Boolean(key && expandedMessages?.[chatId]?.[key]);
}

// Сохраняет ручное развёрнутое состояние одного сообщения.
export function saveManuallyExpandedState(settings, chatId, key, expanded) {
    if (!chatId || !key || !settings) return false;
    if (!settings.manuallyExpandedMessages) settings.manuallyExpandedMessages = {};
    if (!settings.manuallyExpandedMessages[chatId]) settings.manuallyExpandedMessages[chatId] = {};

    const map = settings.manuallyExpandedMessages[chatId];
    let changed = false;
    if (expanded) {
        if (!map[key]) { map[key] = true; changed = true; }
    } else {
        if (map[key]) { delete map[key]; changed = true; }
    }
    return changed;
}

// Атомарно переключает ручное состояние: при collapse добавляет в
// collapsedMessages и убирает из manuallyExpanded; при expand — наоборот.
export function saveManualToggleState(settings, chatId, key, collapsed) {
    const collapsedChanged = saveCollapsedState(settings, chatId, key, collapsed);
    const expandedChanged = saveManuallyExpandedState(settings, chatId, key, !collapsed);
    return collapsedChanged || expandedChanged;
}

// Атомарно переключает ручное состояние набора сообщений (используется
// collapse/expand по отправителю). Возвращает true, если хотя бы один ключ
// изменился. Пропускает null/пустые ключи; не трогает другие чаты.
//
// Важно для инварианта shouldCollapseMessage (приоритет collapsed > expanded):
// при expand ключ обязан уйти из collapsedMessages, иначе на следующем
// onChatChanged сообщение свернётся обратно. Поэтому expand идёт через
// saveManuallyExpandedState(expanded=true), который атомарно удаляет ключ
// из collapsed — а не через ручную запись в карты.
export function setMessagesBulkToggle(settings, chatId, keys, collapsed) {
    if (!chatId || !settings || !keys) return false;
    let changed = false;
    for (const key of keys) {
        if (!key) continue;
        if (saveManualToggleState(settings, chatId, key, collapsed)) {
            changed = true;
        }
    }
    return changed;
}

// Очищает ручное состояние для чата (используется Expand All).
export function clearManualStateForChat(settings, chatId) {
    if (!chatId || !settings) return false;
    let changed = false;
    if (settings.collapsedMessages?.[chatId]) {
        delete settings.collapsedMessages[chatId];
        changed = true;
    }
    if (settings.manuallyExpandedMessages?.[chatId]) {
        delete settings.manuallyExpandedMessages[chatId];
        changed = true;
    }
    return changed;
}

// Разовая миграция устаревшего формата { chatId: [ids] } → { chatId: { id: true } }.
// Возвращает true, если хотя бы один чат был мигрирован.
export function migrateLegacyCollapsedState(collapsedMessages) {
    if (!collapsedMessages) return false;
    let migrated = false;
    for (const chatId in collapsedMessages) {
        if (Array.isArray(collapsedMessages[chatId])) {
            const map = {};
            for (const id of collapsedMessages[chatId]) map[id] = true;
            collapsedMessages[chatId] = map;
            migrated = true;
        }
    }
    return migrated;
}

// Ленивая миграция позиционных ключей (mesid) → стабильных (send_date) per-chat.
// Возвращает true, если миграция для данного чата произошла.
//
// Важно: send_date — это timestamp (большое число), поэтому не путаем его с
// mesid. mesid — валидный индекс в chat, поэтому проверяем 0 <= mesId < chat.length.
export function migratePositionalKeysIfNeeded(collapsedMessages, chat, chatId) {
    const map = collapsedMessages?.[chatId];
    if (!map || !chat) return false;

    const isPositionalKey = (key) => {
        const mesId = parseInt(key);
        return !isNaN(mesId) && mesId >= 0 && mesId < chat.length;
    };

    let needsMigration = false;
    for (const key in map) {
        if (isPositionalKey(key)) { needsMigration = true; break; }
    }
    if (!needsMigration) return false;

    const newMap = {};
    for (const key in map) {
        if (isPositionalKey(key)) {
            const mesId = parseInt(key);
            if (chat[mesId]?.send_date) {
                newMap[String(chat[mesId].send_date)] = true;
            }
        } else {
            newMap[key] = true;
        }
    }
    collapsedMessages[chatId] = newMap;
    return true;
}
