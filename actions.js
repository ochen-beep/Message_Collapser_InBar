// actions.js - Message Collapser InBar
// All logic for working with the chat DOM: adding/removing arrows, collapsing.

export const arrowClass    = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';

// --- Arrow element factory ---------------------------------------------------

/**
 * Creates the arrow button DOM element.
 * Extracted to avoid duplicating markup in multiple places.
 * NOTE: Using string concatenation intentionally — template literals with
 * backticks get corrupted when committed via the GitHub API.
 */
function createArrowElement() {
    return $(
        '<div class="mes_button ' + arrowClass + '" title="Collapse/expand message">' +
        '<i class="fas fa-chevron-up"></i>' +
        '</div>'
    );
}

/**
 * Injects an arrow into a specific message element if not already present.
 * @param {HTMLElement|jQuery} mesElement - the .mes element
 */
function injectArrow(mesElement) {
    const message = $(mesElement);
    if (message.find('.' + arrowClass).length > 0) return;

    const arrow = createArrowElement();
    const buttonsContainer = message.find('.mes_buttons');
    if (buttonsContainer.length) {
        buttonsContainer.prepend(arrow);
    } else {
        message.prepend(arrow);
    }
}

// --- Collapse state helpers --------------------------------------------------

/**
 * Determines whether a message is excluded from the prompt.
 *
 * ST sets the attribute is_system="true" on .mes when the message
 * is disabled via the "Exclude from prompt" button.
 * Checking the attribute directly is more reliable than reading computed CSS
 * (which depends on specific theme/ST version rules).
 *
 * @param {HTMLElement|jQuery} mesElement
 * @returns {boolean}
 */
function isMessageExcludedFromPrompt(mesElement) {
    return $(mesElement).attr('is_system') === 'true';
}

/**
 * Visually collapses a single message.
 * Visibility is controlled by CSS class only — jQuery .hide()/.show() are
 * not needed: the class + style.css rule handle everything.
 */
function collapseMessage(mesElement) {
    const message = $(mesElement);
    message.addClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-up')
           .addClass('fa-chevron-down');
}

/**
 * Visually expands a single message.
 */
function expandMessage(mesElement) {
    const message = $(mesElement);
    message.removeClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-down')
           .addClass('fa-chevron-up');
}

/**
 * Sets the initial state of a single message:
 * - excluded from prompt -> collapse
 * - normal -> expand
 */
function applyInitialCollapseState(mesElement) {
    if (isMessageExcludedFromPrompt(mesElement)) {
        collapseMessage(mesElement);
    } else {
        expandMessage(mesElement);
    }
}

// --- Public API --------------------------------------------------------------

/** Adds arrows to all messages in the chat. */
export function addCollapseArrowsToMessages() {
    $('.mes').each(function () { injectArrow(this); });
}

/** Removes arrows, expands all collapsed messages, stops the observer. */
export function removeCollapseArrowsFromMessages() {
    $('.' + collapsedClass).each(function () { expandMessage(this); });
    $('.' + arrowClass).remove();
    stopObserver();
}

/**
 * Sets the initial state of all messages:
 * excluded from prompt -> collapsed, others -> expanded.
 * Called after addCollapseArrowsToMessages on load/chat change.
 */
export function autoCollapseHiddenMessages() {
    $('.mes').each(function () { applyInitialCollapseState(this); });
}

// --- MutationObserver --------------------------------------------------------

let _collapserObserver = null;

/**
 * Starts a MutationObserver on the chat container.
 *
 * Watches for two types of mutations:
 * 1. childList  - new .mes elements (incoming / streaming messages).
 *    -> inject arrow, apply initial state.
 * 2. attributes / is_system - user clicked "Exclude from prompt" on an
 *    existing message.
 *    -> immediately collapse or expand it.
 */
export function startObserver() {
    if (_collapserObserver) return;
    const chat = document.getElementById('chat');
    if (!chat) return;

    _collapserObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];

            // New messages
            if (mutation.type === 'childList') {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType === 1 && node.classList && node.classList.contains('mes')) {
                        injectArrow(node);
                        applyInitialCollapseState(node);
                    }
                }
            }

            // is_system attribute changed on an existing message
            if (mutation.type === 'attributes') {
                var target = mutation.target;
                var mes = null;
                if (target.classList && target.classList.contains('mes')) {
                    mes = target;
                } else if (typeof target.closest === 'function') {
                    mes = target.closest('.mes');
                }
                if (mes) applyInitialCollapseState(mes);
            }
        }
    });

    _collapserObserver.observe(chat, {
        childList:       true,
        subtree:         true,
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

// --- Click handlers ----------------------------------------------------------

/** Click on an arrow toggles collapse state of that message. */
export function handleArrowClick() {
    var message = $(this).closest('.mes');
    if (message.hasClass(collapsedClass)) {
        expandMessage(message);
    } else {
        collapseMessage(message);
    }
}

export function handleCollapseDisabledClick() {
    var $targets = $('.mes').filter(function () {
        return isMessageExcludedFromPrompt(this) && !$(this).hasClass(collapsedClass);
    });

    if ($targets.length === 0) {
        toastr.info("No uncollapsed 'excluded' messages found.");
        return;
    }

    $targets.each(function () { collapseMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? ' excluded message collapsed.'
            : ' excluded messages collapsed.')
    );
}

export function handleExpandDisabledClick() {
    var $targets = $('.mes').filter(function () {
        return isMessageExcludedFromPrompt(this) && $(this).hasClass(collapsedClass);
    });

    if ($targets.length === 0) {
        toastr.info("No collapsed 'excluded' messages found.");
        return;
    }

    $targets.each(function () { expandMessage(this); });
    toastr.success(
        $targets.length + ($targets.length === 1
            ? ' excluded message expanded.'
            : ' excluded messages expanded.')
    );
}

export function handleCollapseAllClick() {
    var $targets = $('.mes').not('.' + collapsedClass);

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
    var $targets = $('.mes.' + collapsedClass);

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
