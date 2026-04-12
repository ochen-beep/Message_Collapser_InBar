// actions.js - Message Collapser InBar
// All logic for working with the chat DOM: adding/removing arrows, collapsing.

export const arrowClass    = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';

// Key inside chatMetadata where we store collapsed message IDs.
var STORAGE_KEY = 'message_collapser_collapsed';

// --- Persistence (chatMetadata) ----------------------------------------------

/**
 * Returns the collapse-state map for the current chat.
 * Shape: { [mesId: string]: true }
 * Stored in chat_metadata which ST persists inside the .jsonl chat file.
 */
function getCollapseMap() {
    var ctx = SillyTavern.getContext();
    if (!ctx.chat_metadata) return {};
    if (!ctx.chat_metadata[STORAGE_KEY]) {
        ctx.chat_metadata[STORAGE_KEY] = {};
    }
    return ctx.chat_metadata[STORAGE_KEY];
}

/**
 * Saves the current DOM collapse state of every .mes into chatMetadata.
 * Called after every individual collapse/expand action so state is always fresh.
 */
function saveCollapseState() {
    var ctx = SillyTavern.getContext();
    if (!ctx.chat_metadata) return;

    var map = {};
    $('.mes').each(function () {
        var id = $(this).attr('mesid');
        if (id !== undefined && $(this).hasClass(collapsedClass)) {
            map[id] = true;
        }
    });
    ctx.chat_metadata[STORAGE_KEY] = map;

    // Persist immediately — ST debounces internally.
    if (typeof ctx.saveMetadata === 'function') {
        ctx.saveMetadata();
    }
}

// --- Arrow element factory ---------------------------------------------------

/**
 * Creates the arrow button DOM element.
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
 * @param {HTMLElement|jQuery} mesElement
 */
function injectArrow(mesElement) {
    var message = $(mesElement);
    if (message.find('.' + arrowClass).length > 0) return;

    var arrow = createArrowElement();
    var buttonsContainer = message.find('.mes_buttons');
    if (buttonsContainer.length) {
        buttonsContainer.prepend(arrow);
    } else {
        message.prepend(arrow);
    }
}

// --- Collapse state helpers --------------------------------------------------

/**
 * Determines whether a message is excluded from the prompt.
 * ST sets is_system="true" on .mes when the message is disabled.
 */
function isMessageExcludedFromPrompt(mesElement) {
    return $(mesElement).attr('is_system') === 'true';
}

/**
 * Visually collapses a single message and saves state.
 */
function collapseMessage(mesElement) {
    var message = $(mesElement);
    message.addClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-up')
           .addClass('fa-chevron-down');
    saveCollapseState();
}

/**
 * Visually expands a single message and saves state.
 */
function expandMessage(mesElement) {
    var message = $(mesElement);
    message.removeClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-down')
           .addClass('fa-chevron-up');
    saveCollapseState();
}

/**
 * Expands a message WITHOUT touching chatMetadata.
 * Used internally when wiping all arrows (disable extension).
 */
function expandMessageSilent(mesElement) {
    var message = $(mesElement);
    message.removeClass(collapsedClass);
    message.find('.' + arrowClass + ' i')
           .removeClass('fa-chevron-down')
           .addClass('fa-chevron-up');
}

/**
 * Restores saved collapse state from chatMetadata, then auto-collapses
 * any excluded messages that don't already have a saved state.
 *
 * Priority:
 *   1. If the message has an explicit saved state  -> use it.
 *   2. If excluded from prompt and no saved state  -> collapse.
 *   3. Otherwise                                   -> expand.
 *
 * This ensures:
 *   - Manual collapses survive chat reload / CHAT_CHANGED.
 *   - Newly excluded messages are auto-collapsed on first encounter.
 *   - Manually expanded excluded messages stay expanded.
 */
export function restoreAndAutoCollapse() {
    var map = getCollapseMap();
    var hasAnyMap = Object.keys(map).length > 0;

    $('.mes').each(function () {
        var id = $(this).attr('mesid');
        var savedCollapsed = (id !== undefined) ? (map[id] === true) : undefined;

        if (savedCollapsed === true) {
            // Explicit saved: collapsed
            $(this).addClass(collapsedClass);
            $(this).find('.' + arrowClass + ' i')
                   .removeClass('fa-chevron-up').addClass('fa-chevron-down');
        } else if (savedCollapsed === false || (id !== undefined && id in map)) {
            // Explicit saved: expanded (key present but value not true)
            $(this).removeClass(collapsedClass);
            $(this).find('.' + arrowClass + ' i')
                   .removeClass('fa-chevron-down').addClass('fa-chevron-up');
        } else {
            // No saved state for this message:
            // auto-collapse excluded, expand everything else.
            if (isMessageExcludedFromPrompt(this)) {
                $(this).addClass(collapsedClass);
                $(this).find('.' + arrowClass + ' i')
                       .removeClass('fa-chevron-up').addClass('fa-chevron-down');
            } else {
                $(this).removeClass(collapsedClass);
                $(this).find('.' + arrowClass + ' i')
                       .removeClass('fa-chevron-down').addClass('fa-chevron-up');
            }
        }
    });
}

// --- Public API --------------------------------------------------------------

/** Adds arrows to all messages in the chat. */
export function addCollapseArrowsToMessages() {
    $('.mes').each(function () { injectArrow(this); });
}

/** Removes arrows, expands all collapsed messages, stops the observer. */
export function removeCollapseArrowsFromMessages() {
    $('.' + collapsedClass).each(function () { expandMessageSilent(this); });
    $('.' + arrowClass).remove();
    stopObserver();
}

/**
 * Legacy alias — kept so existing callers don't break.
 * Now simply delegates to restoreAndAutoCollapse.
 */
export function autoCollapseHiddenMessages() {
    restoreAndAutoCollapse();
}

// --- MutationObserver --------------------------------------------------------

var _collapserObserver = null;

/**
 * Starts a MutationObserver on the chat container.
 *
 * 1. childList  — new .mes added (incoming/streaming messages).
 *    -> inject arrow, apply initial state (restore or auto-collapse).
 * 2. attributes / is_system — user clicked "Exclude from prompt".
 *    -> only collapse if now excluded AND not already manually expanded.
 *       Never force-expand on attribute change (user may have collapsed it manually).
 */
export function startObserver() {
    if (_collapserObserver) return;
    var chat = document.getElementById('chat');
    if (!chat) return;

    _collapserObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];

            if (mutation.type === 'childList') {
                for (var j = 0; j < mutation.addedNodes.length; j++) {
                    var node = mutation.addedNodes[j];
                    if (node.nodeType === 1 && node.classList && node.classList.contains('mes')) {
                        injectArrow(node);
                        // New message: check saved state, then fall back to auto-collapse logic.
                        var id = $(node).attr('mesid');
                        var map = getCollapseMap();
                        if (id !== undefined && map[id] === true) {
                            $(node).addClass(collapsedClass);
                            $(node).find('.' + arrowClass + ' i')
                                   .removeClass('fa-chevron-up').addClass('fa-chevron-down');
                        } else if (isMessageExcludedFromPrompt(node)) {
                            $(node).addClass(collapsedClass);
                            $(node).find('.' + arrowClass + ' i')
                                   .removeClass('fa-chevron-up').addClass('fa-chevron-down');
                        }
                    }
                }
            }

            if (mutation.type === 'attributes') {
                var target = mutation.target;
                var mes = null;
                if (target.classList && target.classList.contains('mes')) {
                    mes = target;
                } else if (typeof target.closest === 'function') {
                    mes = target.closest('.mes');
                }
                if (mes && isMessageExcludedFromPrompt(mes)) {
                    // Message just got excluded -> collapse it (unless user had
                    // already saved it as expanded, which would be unusual but possible).
                    var mesId = $(mes).attr('mesid');
                    var colMap = getCollapseMap();
                    // Only auto-collapse if there's no explicit saved=false entry.
                    if (mesId === undefined || colMap[mesId] !== false) {
                        collapseMessage(mes);
                    }
                }
                // Note: we intentionally do NOT auto-expand when is_system flips back
                // to false — the user may have manually collapsed it.
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
