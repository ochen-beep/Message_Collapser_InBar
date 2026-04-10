// actions.js — Message Collapser InBar
// Вся логика работы с DOM чата: добавление/удаление стрелочек, сворачивание.

export const arrowClass    = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';

// ─── Arrow element factory ───────────────────────────────────────────────────

/**
 * Создаёт DOM-элемент кнопки-стрелочки.
 * Вынесено отдельно, чтобы не дублировать разметку в нескольких местах.
 */
function createArrowElement() {
    return $(
        `<div class="mes_button ${arrowClass}" title="Свернуть/развернуть сообщение">` +
        '<i class="fas fa-chevron-up"></i>' +
        '</div>'
    );
}

/**
 * Добавляет стрелочку в конкретное сообщение, если её там ещё нет.
 * @param {HTMLElement|jQuery} mesElement — элемент .mes
 */
function injectArrow(mesElement) {
    const message = $(mesElement);
    // Не добавляем повторно
    if (message.find('.' + arrowClass).length > 0) return;

    const arrow = createArrowElement();
    const buttonsContainer = message.find('.mes_buttons');
    if (buttonsContainer.length) {
        buttonsContainer.prepend(arrow);
    } else {
        message.prepend(arrow);
    }
}

// ─── Collapse state helpers ──────────────────────────────────────────────────

/**
 * Определяет, исключено ли сообщение из промпта.
 *
 * ST выставляет атрибут is_system="true" на .mes когда сообщение
 * отключают кнопкой «Exclude from prompt».
 * Проверяем атрибут напрямую — это надёжнее, чем читать computed CSS
 * (который зависит от конкретных правил темы/версии ST).
 *
 * @param {HTMLElement|jQuery} mesElement
 * @returns {boolean}
 */
function isMessageExcludedFromPrompt(mesElement) {
    return $(mesElement).attr('is_system') === 'true';
}

/**
 * Визуально сворачивает одно сообщение.
 * Управление видимостью — только через CSS-класс, jQuery .hide()/.show()
 * не нужны: класс + правило в style.css уже всё делают.
 */
function collapseMessage(mesElement) {
    const message = $(mesElement);
    message.addClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-up')
           .addClass('fa-chevron-down');
}

/**
 * Визуально разворачивает одно сообщение.
 */
function expandMessage(mesElement) {
    const message = $(mesElement);
    message.removeClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-down')
           .addClass('fa-chevron-up');
}

/**
 * Устанавливает начальное состояние одного сообщения:
 * - исключено из промпта → свернуть
 * - обычное → развернуть
 */
function applyInitialCollapseState(mesElement) {
    if (isMessageExcludedFromPrompt(mesElement)) {
        collapseMessage(mesElement);
    } else {
        expandMessage(mesElement);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Добавляет стрелочки ко всем сообщениям в чате. */
export function addCollapseArrowsToMessages() {
    $('.mes').each(function () { injectArrow(this); });
}

/** Убирает стрелочки, разворачивает все свёрнутые сообщения, останавливает observer. */
export function removeCollapseArrowsFromMessages() {
    $('.' + collapsedClass).each(function () { expandMessage(this); });
    $('.' + arrowClass).remove();
    stopObserver();
}

/**
 * Устанавливает начальное состояние всех сообщений:
 * исключённые из промпта сворачиваются, остальные разворачиваются.
 * Вызывается после addCollapseArrowsToMessages при загрузке/смене чата.
 */
export function autoCollapseHiddenMessages() {
    $('.mes').each(function () { applyInitialCollapseState(this); });
}

// ─── MutationObserver ────────────────────────────────────────────────────────

let _collapserObserver = null;

/**
 * Запускает MutationObserver на контейнере чата.
 *
 * Следим за двумя типами мутаций:
 * 1. childList  — новые .mes (входящие/генерируемые сообщения).
 *    → добавляем стрелочку, применяем начальное состояние.
 * 2. attributes / is_system — пользователь нажал «Exclude from prompt»
 *    на уже существующем сообщении.
 *    → немедленно сворачиваем или разворачиваем его.
 */
export function startObserver() {
    if (_collapserObserver) return;
    const chat = document.getElementById('chat');
    if (!chat) return;

    _collapserObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // ── Новые сообщения ──────────────────────────────────────────────
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.classList?.contains('mes')) {
                        injectArrow(node);
                        applyInitialCollapseState(node);
                    }
                }
            }

            // ── Изменение атрибута is_system на существующем сообщении ───────
            if (mutation.type === 'attributes') {
                const mes = mutation.target.closest?.('.mes') ?? (
                    mutation.target.classList?.contains('mes') ? mutation.target : null
                );
                if (mes) applyInitialCollapseState(mes);
            }
        }
    });

    _collapserObserver.observe(chat, {
        childList:       true,
        subtree:         true,   // нужно для attributes на дочерних .mes
        attributes:      true,
        attributeFilter: ['is_system'],
    });
}

export function stopObserver() {
    if (_collapserObserver) {
        _collapserObserver.disconnect();
        _collapserObserver = null;
    }
}

// ─── Click handlers ──────────────────────────────────────────────────────────

/** Клик по стрелочке конкретного сообщения. */
export function handleArrowClick() {
    const message = $(this).closest('.mes');
    if (message.hasClass(collapsedClass)) {
        expandMessage(message);
    } else {
        collapseMessage(message);
    }
}

export function handleCollapseDisabledClick() {
    const $targets = $('.mes').filter(function () {
        return isMessageExcludedFromPrompt(this) && !$(this).hasClass(collapsedClass);
    });

    if ($targets.length === 0) {
        toastr.info("No uncollapsed 'excluded' messages found.");
        return;
    }

    $targets.each(function () { collapseMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? " excluded message collapsed."
            : " excluded messages collapsed.")
    );
}

export function handleExpandDisabledClick() {
    const $targets = $('.mes').filter(function () {
        return isMessageExcludedFromPrompt(this) && $(this).hasClass(collapsedClass);
    });

    if ($targets.length === 0) {
        toastr.info("No collapsed 'excluded' messages found.");
        return;
    }

    $targets.each(function () { expandMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? " excluded message expanded."
            : " excluded messages expanded.")
    );
}

export function handleCollapseAllClick() {
    // Берём только те сообщения, которые ещё не свёрнуты
    const $targets = $('.mes').not('.' + collapsedClass);

    if ($targets.length === 0) {
        toastr.info('All messages are already collapsed.');
        return;
    }

    $targets.each(function () { collapseMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? ' message collapsed.'
            : ' messages collapsed.')
    );
}

export function handleExpandAllClick() {
    // Берём только свёрнутые сообщения
    const $targets = $('.mes.' + collapsedClass);

    if ($targets.length === 0) {
        toastr.info('All messages are already expanded.');
        return;
    }

    $targets.each(function () { expandMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? ' message expanded.'
            : ' messages expanded.')
    );
}
