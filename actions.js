// actions.js - Handles message manipulation and UI actions for Message_Collapser

import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Must match extensionName in main.js
const extensionName = "Message_Collapser_InBar";

export const arrowClass = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';

// ---------------------------------------------------------------------------
// Helpers: persist collapse state in extension_settings
// ---------------------------------------------------------------------------

function getCurrentChatId() {
    return getContext().chatId ?? null;
}

function isManuallyCollapsed(chatId, mesId) {
    return extension_settings[extensionName]?.collapsedMessages?.[chatId]?.includes(mesId) ?? false;
}

function saveCollapsedState(chatId, mesId, collapsed) {
    if (!chatId) return;
    const settings = extension_settings[extensionName];
    if (!settings.collapsedMessages) settings.collapsedMessages = {};
    if (!settings.collapsedMessages[chatId]) settings.collapsedMessages[chatId] = [];

    const list = settings.collapsedMessages[chatId];
    const idx = list.indexOf(mesId);

    if (collapsed && idx === -1) {
        list.push(mesId);
        saveSettingsDebounced();
    } else if (!collapsed && idx !== -1) {
        list.splice(idx, 1);
        saveSettingsDebounced();
    }
}

// ---------------------------------------------------------------------------
// Function to add collapse/expand arrows to messages
// ---------------------------------------------------------------------------

export function addCollapseArrowsToMessages() {
    console.log("Message Collapser: Adding collapse arrows.");
    $('.mes').each(function() {
        const message = $(this);
        if (message.find('.' + arrowClass).length === 0) {
            const arrowElement = $('<div class="mes_button ' + arrowClass + '" title="Свернуть/развернуть сообщение"><i class="fas fa-chevron-up"></i></div>');
            const buttonsContainer = message.find('.mes_buttons');
            if (buttonsContainer.length) {
                buttonsContainer.prepend(arrowElement);
            } else {
                message.prepend(arrowElement);
            }
        }
    });
}

// Observer to add arrows to newly added messages (e.g. streaming)
let _collapserObserver = null;

export function startObserver() {
    if (_collapserObserver) return;
    const chat = document.getElementById('chat');
    if (!chat) return;
    _collapserObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('mes')) {
                    const message = $(node);
                    if (message.find('.' + arrowClass).length === 0) {
                        const arrowElement = $('<div class="mes_button ' + arrowClass + '" title="Свернуть/развернуть сообщение"><i class="fas fa-chevron-up"></i></div>');
                        const buttonsContainer = message.find('.mes_buttons');
                        if (buttonsContainer.length) {
                            buttonsContainer.prepend(arrowElement);
                        } else {
                            message.prepend(arrowElement);
                        }
                    }
                    // Устанавливаем начальное состояние для только что добавленного сообщения
                    applyInitialCollapseState(node);
                }
            }
        }
    });
    _collapserObserver.observe(chat, { childList: true });
}

export function stopObserver() {
    if (_collapserObserver) {
        _collapserObserver.disconnect();
        _collapserObserver = null;
    }
}

// Function to remove collapse/expand arrows from messages
export function removeCollapseArrowsFromMessages() {
    console.log("Message Collapser: Removing collapse arrows.");
    $('.' + collapsedClass).each(function() {
        $(this).find('.mes_text').show();
        $(this).removeClass(collapsedClass);
    });
    $('.' + arrowClass).remove();
    stopObserver();
}

// Handler for clicking an arrow
export function handleArrowClick(event) {
    const arrowSpan = $(this);
    const icon = arrowSpan.find('i');
    const message = arrowSpan.closest('.mes');
    const messageText = message.find('.mes_text');

    messageText.toggle();
    message.toggleClass(collapsedClass);

    const isNowCollapsed = !messageText.is(':visible');
    if (isNowCollapsed) {
        icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    } else {
        icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    }

    // Persist the new state
    const mesId = parseInt(message.attr('mesid'));
    const chatId = getCurrentChatId();
    if (!isNaN(mesId) && chatId) {
        saveCollapsedState(chatId, mesId, isNowCollapsed);
    }
}

/**
 * Определяет, исключено ли сообщение из промпта.
 *
 * .mes_unhide.fa-eye-slash присутствует в DOM у КАЖДОГО сообщения.
 * ST скрывает её через CSS: .mes[is_system="false"] .mes_unhide { display: none; }
 * Когда сообщение исключают из промпта — is_system меняется, правило перестаёт
 * применяться, и кнопка получает ненулевой display.
 *
 * jQuery .css('display') возвращает собственный computed display элемента,
 * не зависящий от display:none у родителя (.extraMesButtons),
 * поэтому работает корректно вне зависимости от того, открыта ли панель действий.
 */
function isMessageExcludedFromPrompt(mesElement) {
    const $unhide = $(mesElement).find('.mes_unhide.fa-eye-slash');
    return $unhide.length > 0 && $unhide.css('display') !== 'none';
}

/**
 * Устанавливает начальное состояние одного сообщения:
 * - исключено из промпта → свернуть
 * - вручную свёрнуто пользователем (сохранено в settings) → свернуть
 * - иначе → развернуть
 */
function applyInitialCollapseState(mesElement) {
    const message = $(mesElement);
    const messageText = message.find('.mes_text');
    const icon = message.find('.' + arrowClass + ' i');

    const chatId = getCurrentChatId();
    const mesId = parseInt(message.attr('mesid'));
    const manuallyCollapsed = !isNaN(mesId) && !!chatId && isManuallyCollapsed(chatId, mesId);

    if (isMessageExcludedFromPrompt(mesElement) || manuallyCollapsed) {
        messageText.hide();
        message.addClass(collapsedClass);
        if (icon.length) icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
    } else {
        messageText.show();
        message.removeClass(collapsedClass);
        if (icon.length) icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
    }
}

/**
 * Устанавливает начальное состояние всех сообщений в чате:
 * исключённые из промпта и вручную свёрнутые сворачиваются, остальные разворачиваются.
 * Вызывается после addCollapseArrowsToMessages при загрузке/смене чата.
 */
export function autoCollapseHiddenMessages() {
    $('.mes').each(function() {
        applyInitialCollapseState(this);
    });
}

export function handleCollapseDisabledClick() {
    const $disabledMessages = $('.mes').filter(function() {
        return isMessageExcludedFromPrompt(this);
    });

    if ($disabledMessages.length === 0) {
        toastr.info("No 'hidden' messages found to collapse.");
        return;
    }

    let count = 0;
    $disabledMessages.each(function() {
        const message = $(this);
        const messageText = message.find('.mes_text');
        const arrowSpan = message.find('.' + arrowClass);
        const icon = arrowSpan.find('i');

        messageText.hide();
        message.addClass(collapsedClass);
        if (arrowSpan.length && icon.length) {
            icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
        }
        count++;
    });

    if (count > 0) {
        toastr.success(count + (count === 1 ? " 'hidden' message collapsed." : " 'hidden' messages collapsed."));
    } else {
        toastr.info("No 'hidden' messages found to collapse (post-loop check).");
    }
}

export function handleExpandDisabledClick() {
    const $disabledMessages = $('.mes').filter(function() {
        return isMessageExcludedFromPrompt(this);
    });

    if ($disabledMessages.length === 0) {
        toastr.info("No 'hidden' messages found to expand.");
        return;
    }

    let count = 0;
    $disabledMessages.each(function() {
        const message = $(this);
        const messageText = message.find('.mes_text');
        const arrowSpan = message.find('.' + arrowClass);
        const icon = arrowSpan.find('i');

        messageText.show();
        message.removeClass(collapsedClass);
        if (arrowSpan.length && icon.length) {
            icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
        }
        count++;
    });

    if (count > 0) {
        toastr.success(count + (count === 1 ? " 'hidden' message expanded." : " 'hidden' messages expanded."));
    } else {
        toastr.info("No 'hidden' messages found to expand (post-loop check).");
    }
}

export function handleExpandAllClick() {
    console.log("Message Collapser: Expanding all messages.");
    let count = 0;
    $('.mes').each(function() {
        const message = $(this);
        if (message.find('.mes_text').is(':hidden') || message.hasClass(collapsedClass)) {
            const messageText = message.find('.mes_text');
            const arrowSpan = message.find('.' + arrowClass);
            const icon = arrowSpan.find('i');

            messageText.show();
            message.removeClass(collapsedClass);
            if (arrowSpan.length && icon.length) {
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-up');
            }
            count++;
        }
    });

    // Clear saved manual collapse state for this chat
    const chatId = getCurrentChatId();
    if (chatId && extension_settings[extensionName]?.collapsedMessages) {
        extension_settings[extensionName].collapsedMessages[chatId] = [];
        saveSettingsDebounced();
    }

    if (count > 0) {
        toastr.success(count + (count === 1 ? " message expanded." : " messages expanded."));
    } else {
        toastr.info("All messages already expanded or no messages to expand.");
    }
}

export function handleCollapseAllClick() {
    console.log("Message Collapser: Collapsing all messages.");
    let count = 0;
    const collapsedIds = [];

    $('.mes').each(function() {
        const message = $(this);
        const messageText = message.find('.mes_text');
        const arrowSpan = message.find('.' + arrowClass);
        const icon = arrowSpan.find('i');

        if (messageText.is(':visible') || !message.hasClass(collapsedClass)) {
            messageText.hide();
            message.addClass(collapsedClass);
            if (arrowSpan.length && icon.length) {
                icon.removeClass('fa-chevron-up').addClass('fa-chevron-down');
            }
            count++;
        }

        // Collect all mesids regardless — after this action every message is collapsed
        const mesId = parseInt(message.attr('mesid'));
        if (!isNaN(mesId)) collapsedIds.push(mesId);
    });

    // Persist the full collapsed list for this chat
    const chatId = getCurrentChatId();
    if (chatId) {
        const settings = extension_settings[extensionName];
        if (!settings.collapsedMessages) settings.collapsedMessages = {};
        settings.collapsedMessages[chatId] = collapsedIds;
        saveSettingsDebounced();
    }

    if (count > 0) {
        toastr.success(count + (count === 1 ? " message collapsed." : " messages collapsed."));
    } else {
        toastr.info("All messages already collapsed or no messages to collapse.");
    }
}
