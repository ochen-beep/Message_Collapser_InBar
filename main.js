// main.js — Message Collapser InBar
// Точка входа: регистрация настроек, навешивание обработчиков событий ST.

import {
    arrowClass,
    addCollapseArrowsToMessages,
    removeCollapseArrowsFromMessages,
    autoCollapseHiddenMessages,
    startObserver,
    stopObserver,
    handleArrowClick,
    handleCollapseAllClick,
    handleExpandAllClick,
    handleCollapseDisabledClick,
    handleExpandDisabledClick,
} from './actions.js';

const extensionName = 'Message_Collapser_InBar';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    isEnabled: false,
};

// ─── Settings helpers ────────────────────────────────────────────────────────

function getSettings() {
    // SillyTavern.getContext() — стабильный публичный API, не зависящий от
    // внутренней структуры модулей ST (в отличие от прямых ES-импортов).
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[extensionName]) {
        extensionSettings[extensionName] = structuredClone(defaultSettings);
    }
    for (const key in defaultSettings) {
        if (extensionSettings[extensionName][key] === undefined) {
            extensionSettings[extensionName][key] = defaultSettings[key];
        }
    }
    return extensionSettings[extensionName];
}

function saveSettings() {
    SillyTavern.getContext().saveSettingsDebounced();
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

/**
 * Блокирует/разблокирует кнопки действий панели настроек.
 * Кнопки бессмысленны, пока расширение выключено — стрелочек в чате нет.
 */
function setActionButtonsDisabled(disabled) {
    $('#mc-inbar-collapse-all, #mc-inbar-expand-all, #mc-inbar-collapse-disabled, #mc-inbar-expand-disabled')
        .prop('disabled', disabled);
}

// ─── Event handlers ──────────────────────────────────────────────────────────

function handleMasterEnableToggleChange(event) {
    const settings = getSettings();
    settings.isEnabled = Boolean($(event.target).prop('checked'));
    saveSettings();
    setActionButtonsDisabled(!settings.isEnabled);

    if (settings.isEnabled) {
        addCollapseArrowsToMessages();
        autoCollapseHiddenMessages();
        startObserver();
    } else {
        stopObserver();
        removeCollapseArrowsFromMessages();
    }
}

// ─── Initialization ──────────────────────────────────────────────────────────

jQuery(async () => {
    const { eventSource, event_types } = SillyTavern.getContext();

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings_panel.html`);
        $('#extensions_settings').append(settingsHtml);
    } catch (error) {
        console.error('[Message Collapser] Failed to load settings HTML:', error);
        toastr.error('Message Collapser: не удалось загрузить панель настроек.');
        return;
    }

    const settings = getSettings();
    $('#mc-inbar-master-enable').prop('checked', settings.isEnabled);
    setActionButtonsDisabled(!settings.isEnabled);

    // Навешиваем обработчики элементов панели
    $('#mc-inbar-master-enable').on('change', handleMasterEnableToggleChange);
    $('#mc-inbar-collapse-disabled').on('click', handleCollapseDisabledClick);
    $('#mc-inbar-expand-disabled').on('click', handleExpandDisabledClick);
    $('#mc-inbar-expand-all').on('click', handleExpandAllClick);
    $('#mc-inbar-collapse-all').on('click', handleCollapseAllClick);

    // Делегированный обработчик для стрелочек — работает и для новых сообщений
    $(document).on('click', '.' + arrowClass, handleArrowClick);

    // APP_READY гарантирует, что чат уже загружен и отрендерен.
    // Если ST уже готов к моменту подписки — событие стреляет синхронно.
    eventSource.on(event_types.APP_READY, () => {
        if (getSettings().isEnabled) {
            addCollapseArrowsToMessages();
            autoCollapseHiddenMessages();
            startObserver();
        }
    });

    // CHAT_CHANGED стреляет при каждой смене персонажа/чата.
    // ST пересоздаёт весь список .mes, поэтому стрелочки нужно добавить заново.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (!getSettings().isEnabled) return;
        // ST рендерит новые сообщения асинхронно после события,
        // поэтому добавляем небольшую задержку.
        setTimeout(() => {
            addCollapseArrowsToMessages();
            autoCollapseHiddenMessages();
        }, 150);
    });
});
