import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

import {
    buildSettings,
    getStableMessageKey as getStableMessageKeyFromState,
    isManuallyCollapsed as isManuallyCollapsedFromState,
    isManuallyExpanded as isManuallyExpandedFromState,
    saveManualToggleState as saveManualToggleStateToState,
    setMessagesBulkToggle as setMessagesBulkToggleInState,
    clearManualStateForChat,
    migrateLegacyCollapsedState as migrateLegacyCollapsedStateInPlace,
    migratePositionalKeysIfNeeded as migratePositionalKeysInPlace,
} from './state.js';
import { t } from './i18n.js';

// Единственный источник имени расширения; main.js импортирует отсюда.
export const extensionName = "Message_Collapser_InBar";

export const arrowClass = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';
export const previewClass = 'message-collapser-preview';

// Пространство имён для делегированных обработчиков, чтобы можно было безопасно
// снять их (и защититься от повторной инициализации).
export const eventNamespace = '.mc';

// Настройки: источник истины свёрнутости — CSS-класс (см. style.css,
// .message-collapser-message-collapsed .mes_text { display:none !important }).
// Inline .hide()/.show() не используем: класс достаточно, а чтений :visible
// (layout-read) удаётся избежать целиком.

// Единая точка доступа к настройкам расширения с авто-инициализацией дефолтов.
// Чистая логика инициализации/миграции вынесена в state.js для тестируемости.
export function getSettings() {
    return buildSettings(extension_settings, extensionName);
}

function getCurrentChatId() {
    return getContext().chatId ?? null;
}

// Стабильный ключ сообщения. mesid — позиция в массиве chat, она плывёт при
// удалении/переупорядочивании: удаление сообщения №3 сдвигает все свёрнутости
// ниже на одну позицию (молчаливая порча данных). send_date — timestamp,
// проставляемый ST при рождении сообщения (getMessageTimeStamp) и не
// меняющийся до конца его жизни; он уникален в пределах чата. Ключуем по нему.
// Если send_date неожиданно отсутствует — возвращаем null и НЕ персистим
// (только визуальный эффект в текущей сессии), чтобы не плодить мусор.
function getStableMessageKey(mesElement) {
    return getStableMessageKeyFromState(getContext().chat, mesElement);
}

function isManuallyCollapsed(chatId, key) {
    return isManuallyCollapsedFromState(getSettings()?.collapsedMessages, chatId, key);
}

function isManuallyExpanded(chatId, key) {
    return isManuallyExpandedFromState(getSettings()?.manuallyExpandedMessages, chatId, key);
}

// Сохраняет ручное состояние сворачивания/разворачивания одного сообщения.
// При collapse сообщение убирается из manuallyExpanded, при expand — из collapsedMessages,
// чтобы ручной выбор всегда переопределял авто-сворачивание.
function saveManualToggleState(chatId, key, collapsed) {
    const changed = saveManualToggleStateToState(getSettings(), chatId, key, collapsed);
    if (changed) saveSettingsDebounced();
}

// Разовая миграция устаревшего формата { chatId: [ids] } → { chatId: { id: true } }.
export function migrateLegacyCollapsedState() {
    migrateLegacyCollapsedStateInPlace(getSettings().collapsedMessages);
}

// Ленивая миграция позиционных ключей (mesid) → стабильных (send_date) per-chat.
// Невозможно разрешить mesid→send_date без загруженного чата, поэтому делаем это
// здесь, когда нужный чат открыт и getContext().chat доступен. Срабатывает один
// раз на чат: после конвертации ключи перестают быть «числовыми».
function migratePositionalKeysIfNeeded(chatId) {
    const changed = migratePositionalKeysInPlace(
        getSettings()?.collapsedMessages,
        getContext().chat,
        chatId
    );
    if (changed) saveSettingsDebounced();
}

// DOM-примитивы

// ST фильтрует сообщения по chat[mesId].is_system и зеркалирует его в атрибут
// is_system элемента .mes в hideChatMessageRange (см. .mes:not([is_system="true"])
// в самом script.js). Прямой getAttribute — дешёвый (без reflow) источник истины,
// пришедший на смену хрупкой эвристике через computed display кнопки .mes_unhide.
function isMessageHiddenFromPrompt(mesElement) {
    return mesElement.getAttribute('is_system') === 'true';
}

// Идемпотентно добавляет стрелку-кнопку в панель действий сообщения.
// Класс расширения уникален, поэтому .find() безопасен и покрывает оба варианта
// размещения (внутри .mes_buttons или напрямую в .mes).
// Элемент имеет role/tabindex/aria для доступности (см. handleArrowKeydown).
function ensureArrow($message) {
    let $arrow = $message.find('.' + arrowClass).first();
    if ($arrow.length === 0) {
        $arrow = $(`<div class="mes_button ${arrowClass}" role="button" tabindex="0" aria-expanded="true" title="${t('mc_arrow_title')}"><i class="fas fa-chevron-up"></i></div>`);
        const $buttons = $message.find('.mes_buttons');
        ($buttons.length ? $buttons : $message).prepend($arrow);
    }
    return $arrow;
}

// Устанавливает свёрнутое состояние через класс + иконку + ARIA. Единственная точка записи.
// fa-chevron-up = развёрнуто («свернуть»), fa-chevron-down = свёрнуто («развернуть»).
// Если включён режим предпросмотра, свёрнутые сообщения показывают первые N строк.
function applyCollapsedState($message, $arrow, collapsed) {
    const usePreview = collapsed && getSettings().previewMode === 'preview';
    $message.toggleClass(collapsedClass, collapsed);
    $message.toggleClass(previewClass, usePreview);
    if ($arrow.length) {
        $arrow.attr('aria-expanded', collapsed ? 'false' : 'true')
              .find('i').toggleClass('fa-chevron-up', !collapsed)
                        .toggleClass('fa-chevron-down', collapsed);
    }
}

// Авто-сворачивание по длине сообщения и/или возрасту (отступ от конца чата).
// Не персистится — вычисляется при каждой отрисовке.
function shouldAutoCollapse(mesElement) {
    const settings = getSettings();
    if (!settings.autoCollapseByLength && !settings.autoCollapseByAge) return false;

    const mesId = parseInt(mesElement.getAttribute('mesid'));
    if (isNaN(mesId)) return false;
    const message = getContext().chat?.[mesId];
    if (!message) return false;

    if (settings.autoCollapseByLength && message.mes && message.mes.length >= settings.lengthThreshold) {
        return true;
    }

    if (settings.autoCollapseByAge) {
        const chat = getContext().chat;
        if (chat && chat.length - mesId - 1 >= settings.ageThreshold) {
            return true;
        }
    }

    return false;
}

// Решение о сворачивании конкретного сообщения. Приоритет:
// 1. Сообщения, исключённые из промпта (is_system) — всегда свёрнуты.
// 2. Вручную свёрнутые — свёрнуты.
// 3. Вручную развёрнутые — развёрнуты (переопределяют авто-сворачивание).
// 4. Правила авто-сворачивания.
function shouldCollapseMessage(mesElement, chatId) {
    const key = getStableMessageKey(mesElement);
    if (isMessageHiddenFromPrompt(mesElement)) return true;
    if (!!chatId && isManuallyCollapsed(chatId, key)) return true;
    if (!!chatId && isManuallyExpanded(chatId, key)) return false;
    return shouldAutoCollapse(mesElement);
}

function processMessages($messages, chatId) {
    $messages.each(function () {
        const $message = $(this);
        const $arrow = ensureArrow($message);
        applyCollapsedState($message, $arrow, shouldCollapseMessage(this, chatId));
    });
}

// Observer: добавляет стрелки к новым сообщениям (стриминг, смена чата).
// Коалесцирует все addedNodes тика в один flush через queueMicrotask —
// полная перестройка чата = один батч, а не N коллбэков.
//
// ВАЖНО: при смене чата узлы приходят и в MutationObserver, и обрабатываются
// синхронно в onChatChanged(). onChatChanged сбрасывает накопленные узлы, иначе
// они прошли бы через _flushNewNodes вторым проходом (двойная работа на длинных
// чатах). Set гарантирует дедупликацию, если один узел arrive в нескольких мутациях.

let _collapserObserver = null;
let _pendingNewNodes = new Set();
let _flushScheduled = false;

function _flushNewNodes() {
    _flushScheduled = false;
    if (_pendingNewNodes.size === 0) return;
    const nodes = _pendingNewNodes;
    _pendingNewNodes = new Set();
    const chatId = getCurrentChatId();
    for (const node of nodes) {
        const $message = $(node);
        const $arrow = ensureArrow($message);
        applyCollapsedState($message, $arrow, shouldCollapseMessage(node, chatId));
    }
}

export function startObserver() {
    if (_collapserObserver) return;
    const chat = document.getElementById('chat');
    if (!chat) return;
    _collapserObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('mes')) {
                    _pendingNewNodes.add(node);
                }
            }
        }
        if (_pendingNewNodes.size > 0 && !_flushScheduled) {
            _flushScheduled = true;
            queueMicrotask(_flushNewNodes);
        }
    });
    _collapserObserver.observe(chat, { childList: true });
}

export function stopObserver() {
    if (_collapserObserver) {
        _collapserObserver.disconnect();
        _collapserObserver = null;
    }
    _pendingNewNodes = new Set();
    _flushScheduled = false;
}

// Выключение расширения: убрать стрелки и развернуть всё.
// Состояние свёрнутости управляется только CSS-классом; inline-стилей
// display:none расширение не выставляет, поэтому достаточно снять класс.
export function removeCollapseArrowsFromMessages() {
    $('.' + collapsedClass).removeClass(collapsedClass);
    $('.' + arrowClass).remove();
    stopObserver();
}

// Единая точка очистки: observer, стрелки, делегированные обработчики.
// Используется при disable и при hot-reload.
export function destroy() {
    removeCollapseArrowsFromMessages();
    $(document).off(eventNamespace);
}

// ---------------------------------------------------------------------------
// Обработчики
// ---------------------------------------------------------------------------

function toggleMessage($message) {
    const $arrow = $message.find('.' + arrowClass).first();
    const isCollapsed = $message.hasClass(collapsedClass);
    const nowCollapsed = !isCollapsed;
    applyCollapsedState($message, $arrow, nowCollapsed);

    const key = getStableMessageKey($message[0]);
    const chatId = getCurrentChatId();
    if (key && chatId) {
        saveManualToggleState(chatId, key, nowCollapsed);
    }
}

export function handleArrowClick(event) {
    // Делегированный клик: цель могла быть внутренней (иконка <i>), берём
    // ближайшую стрелку и от неё — ближайшее сообщение.
    const $arrow = $(event.target).closest('.' + arrowClass);
    const $message = $arrow.closest('.mes');
    if ($message.length) toggleMessage($message);
}

// Переключает состояние конкретного сообщения по его mesid. Используется
// слэш-командой /mc-toggle.
export function toggleMessageByMesId(mesId) {
    const $message = $(`.mes[mesid="${mesId}"]`);
    if ($message.length === 0) {
        toastr.warning(t('mc_toast_message_not_found', { mesId }));
        return;
    }
    toggleMessage($message);
}

// Клавиатурная активация стрелки (Enter/Space) — доступность: role=button.
export function handleArrowKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const $arrow = $(event.target).closest('.' + arrowClass);
    if (!$arrow.length) return;
    event.preventDefault();
    const $message = $arrow.closest('.mes');
    if ($message.length) toggleMessage($message);
}

// Чат загружен/переключён (событие ST CHAT_CHANGED). За один проход по
// .mes вставляет стрелки и выставляет начальное состояние: исключённые из
// промпта и вручную свёрнутые — свёрнуты, остальные — развёрнуты.
export function onChatChanged() {
    if (!getSettings()?.isEnabled) return;
    const chatId = getCurrentChatId();
    if (chatId) migratePositionalKeysIfNeeded(chatId);

    // Синхронная обработка уже покрывает все текущие .mes. Сбрасываем очередь
    // observer-а, иначе те же узлы пройдут вторым проходом в _flushNewNodes.
    _pendingNewNodes = new Set();
    _flushScheduled = false;

    processMessages($('.mes'), chatId);
}

// Чат удалён (событие ST CHAT_DELETED). Удаляет сохранённое состояние
// сворачивания для удалённого чата, чтобы collapsedMessages не рос бесконечно.
// ST передаёт имя файла чата без .jsonl — это тот же ключ, под которым
// сохраняем (characters[chatId].chat / getCurrentChatId()).
export function onChatDeleted(chatId) {
    const settings = getSettings();
    if (!chatId) return;
    let changed = false;
    if (settings?.collapsedMessages?.[chatId]) {
        delete settings.collapsedMessages[chatId];
        changed = true;
    }
    if (settings?.manuallyExpandedMessages?.[chatId]) {
        delete settings.manuallyExpandedMessages[chatId];
        changed = true;
    }
    if (changed) saveSettingsDebounced();
}

function setHiddenMessagesCollapsed(collapsed) {
    const $hidden = $('.mes').filter(function () {
        return isMessageHiddenFromPrompt(this);
    });
    if ($hidden.length === 0) {
        toastr.info(collapsed ? t('mc_toast_no_hidden_collapse') : t('mc_toast_no_hidden_expand'));
        return;
    }
    $hidden.each(function () {
        applyCollapsedState($(this), ensureArrow($(this)), collapsed);
    });
    const hiddenCollapsed = t('mc_toast_hidden_collapsed', { count: $hidden.length });
    toastr.success(hiddenCollapsed);
}

export function handleCollapseHiddenClick() {
    setHiddenMessagesCollapsed(true);
}

export function handleExpandHiddenClick() {
    setHiddenMessagesCollapsed(false);
}

// Сворачивание/разворачивание по типу отправителя

function isMessageSender(mesElement, senderType) {
    if (senderType === 'user') return mesElement.getAttribute('is_user') === 'true';
    if (senderType === 'system') return mesElement.getAttribute('is_system') === 'true';
    if (senderType === 'character') {
        return mesElement.getAttribute('is_user') !== 'true' &&
               mesElement.getAttribute('is_system') !== 'true';
    }
    return false;
}

function setMessagesBySenderCollapsed(senderType, collapsed) {
    const $matches = $('.mes').filter(function () {
        return isMessageSender(this, senderType);
    });
    if ($matches.length === 0) {
        toastr.info(t('mc_toast_no_sender_messages', { sender: senderType }));
        return;
    }

    const chatId = getCurrentChatId();
    const settings = chatId ? getSettings() : null;

    const keys = [];
    $matches.each(function () {
        applyCollapsedState($(this), ensureArrow($(this)), collapsed);
        if (chatId) {
            const key = getStableMessageKey(this);
            if (key) keys.push(key);
        }
    });

    if (chatId && settings) {
        // Персист через атомарную bulk-функцию, сохраняющую инвариант приоритета
        // collapsed > expanded: collapse добавляет ключи в collapsedMessages и
        // убирает ТОЛЬКО matching-ключи из manuallyExpanded (не весь объект чата —
        // иначе сносятся чужие ручные разворачивания других отправителей);
        // expand обязан удалить ключи из collapsedMessages, иначе на следующем
        // onChatChanged сообщение свернётся обратно.
        if (setMessagesBulkToggleInState(settings, chatId, keys, collapsed)) {
            saveSettingsDebounced();
        }
    }

    const senderCollapsed = t('mc_toast_sender_collapsed', { count: $matches.length, sender: senderType });
    toastr.success(senderCollapsed);
}

export function handleCollapseUserClick()      { setMessagesBySenderCollapsed('user', true); }
export function handleExpandUserClick()        { setMessagesBySenderCollapsed('user', false); }
export function handleCollapseCharacterClick() { setMessagesBySenderCollapsed('character', true); }
export function handleExpandCharacterClick()   { setMessagesBySenderCollapsed('character', false); }
export function handleCollapseSystemClick()    { setMessagesBySenderCollapsed('system', true); }
export function handleExpandSystemClick()      { setMessagesBySenderCollapsed('system', false); }

export function handleExpandAllClick() {
    const $collapsed = $('.mes').filter('.' + collapsedClass);
    $collapsed.each(function () {
        applyCollapsedState($(this), ensureArrow($(this)), false);
    });

    // Очищаем сохранённое ручное состояние для этого чата. Сообщения, свёрнутые
    // как is_system (hidden из промпта), на следующей загрузке свернутся снова —
    // это их собственный флаг, а не ручное состояние; им управляет eye-icon.
    const chatId = getCurrentChatId();
    if (chatId) {
        const changed = clearManualStateForChat(getSettings(), chatId);
        if (changed) saveSettingsDebounced();
    }

    if ($collapsed.length > 0) {
        toastr.success(t('mc_toast_all_expanded', { count: $collapsed.length }));
    } else {
        toastr.info(t('mc_toast_all_already_expanded'));
    }
}

export function handleCollapseAllClick() {
    const $messages = $('.mes');
    const collapsedMap = {};
    let changed = 0;

    $messages.each(function () {
        const $message = $(this);
        const wasCollapsed = $message.hasClass(collapsedClass);
        if (!wasCollapsed) {
            applyCollapsedState($message, ensureArrow($message), true);
            changed++;
        }
        // После действия каждое сообщение свёрнуто. Фиксируем только ручное
        // состояние по стабильному ключу; is_system-сообщения в карте не нужны —
        // они свёрнуты собственным флагом и разворачиваются через eye-icon,
        // а дублирование в manual-карте расходится с семантикой Expand All.
        if (!isMessageHiddenFromPrompt(this)) {
            const key = getStableMessageKey(this);
            if (key) collapsedMap[key] = true;
        }
    });

    const chatId = getCurrentChatId();
    if (chatId) {
        const settings = getSettings();
        if (!settings.collapsedMessages) settings.collapsedMessages = {};
        settings.collapsedMessages[chatId] = collapsedMap;
        // Ручные развёртывания больше не актуальны: всё свёрнуто.
        if (settings.manuallyExpandedMessages?.[chatId]) {
            delete settings.manuallyExpandedMessages[chatId];
        }
        saveSettingsDebounced();
    }

    if (changed > 0) {
        toastr.success(t('mc_toast_all_collapsed', { count: changed }));
    } else {
        toastr.info(t('mc_toast_all_already_collapsed'));
    }
}
