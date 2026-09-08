// @ts-check
/**
 * Message Collapser — Bulk actions.
 * Collapse/expand by target group (prompt-hidden, user, character, system,
 * everything), exposed to the settings panel buttons and the slash commands.
 */

import { saveSettingsDebounced } from '../../../../script.js';
import { collapsedClass, getSettings, getCtx } from './core.js';
import {
    getStableMessageKey as getStableMessageKeyFromState,
    setMessagesBulkToggle as setMessagesBulkToggleInState,
    clearManualStateForChat,
} from './state.js';
import { tr } from './i18n.js';
import { ensureArrow, applyCollapsedState, isMessageHiddenFromPrompt } from './collapse.js';

function getCurrentChatId() {
    return getCtx().chatId ?? null;
}

function getStableMessageKey(mesElement) {
    return getStableMessageKeyFromState(getCtx().chat, mesElement);
}

// ── Prompt-hidden messages ──

function setHiddenMessagesCollapsed(collapsed) {
    const $hidden = $('.mes').filter(function () {
        return isMessageHiddenFromPrompt(this);
    });
    if ($hidden.length === 0) {
        toastr.info(tr(`No prompt-hidden messages to ${collapsed ? 'collapse' : 'expand'}.`, collapsed ? 'mc.toast.noHiddenCollapse' : 'mc.toast.noHiddenExpand'));
        return;
    }
    $hidden.each(function () {
        applyCollapsedState($(this), ensureArrow($(this)), collapsed);
    });
    toastr.success(tr('{count} hidden message collapsed.|{count} hidden messages collapsed.', 'mc.toast.hiddenCollapsed', { count: $hidden.length }));
}

/** Collapse every prompt-hidden (is_system) message. */
export function handleCollapseHiddenClick() {
    setHiddenMessagesCollapsed(true);
}

/** Expand every prompt-hidden (is_system) message. */
export function handleExpandHiddenClick() {
    setHiddenMessagesCollapsed(false);
}

// ── Collapse/expand by sender type ──

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
        toastr.info(tr('No messages from sender {sender}.', 'mc.toast.noSenderMessages', { sender: senderType }));
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
        // Persist through the atomic bulk toggle that keeps the
        // collapsed > expanded priority invariant: collapse adds the keys to
        // collapsedMessages and removes ONLY those keys from
        // manuallyExpandedMessages (not the whole chat object — that would
        // wipe unrelated manual expansions of other senders); expand MUST
        // delete the keys from collapsedMessages or the next onChatChanged
        // collapses everything back.
        if (setMessagesBulkToggleInState(settings, chatId, keys, collapsed)) {
            saveSettingsDebounced();
        }
    }

    toastr.success(tr(
        '{count} message from sender {sender} collapsed.|{count} messages from sender {sender} collapsed.',
        'mc.toast.senderCollapsed',
        { count: $matches.length, sender: senderType },
    ));
}

export function handleCollapseUserClick()      { setMessagesBySenderCollapsed('user', true); }
export function handleExpandUserClick()        { setMessagesBySenderCollapsed('user', false); }
export function handleCollapseCharacterClick() { setMessagesBySenderCollapsed('character', true); }
export function handleExpandCharacterClick()   { setMessagesBySenderCollapsed('character', false); }
export function handleCollapseSystemClick()    { setMessagesBySenderCollapsed('system', true); }
export function handleExpandSystemClick()      { setMessagesBySenderCollapsed('system', false); }

// ── Expand all / collapse all ──

export function handleExpandAllClick() {
    const $collapsed = $('.mes').filter('.' + collapsedClass);
    $collapsed.each(function () {
        applyCollapsedState($(this), ensureArrow($(this)), false);
    });

    // Clear the saved manual state of this chat. Messages collapsed as
    // is_system (prompt-hidden) will collapse again on the next load — that
    // is their own flag, not manual state; the eye icon governs it.
    const chatId = getCurrentChatId();
    if (chatId) {
        const changed = clearManualStateForChat(getSettings(), chatId);
        if (changed) saveSettingsDebounced();
    }

    if ($collapsed.length > 0) {
        toastr.success(tr('{count} message expanded.|{count} messages expanded.', 'mc.toast.allExpanded', { count: $collapsed.length }));
    } else {
        toastr.info(tr('All messages are already expanded — nothing to expand.', 'mc.toast.allAlreadyExpanded'));
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
        // After the action every message is collapsed. Persist only the
        // manual state by stable key; is_system messages stay out of the map —
        // they are collapsed by their own flag and expanded via the eye icon,
        // and duplicating them here would diverge from Expand All semantics.
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
        // Manual expansions are obsolete: everything is collapsed now.
        if (settings.manuallyExpandedMessages?.[chatId]) {
            delete settings.manuallyExpandedMessages[chatId];
        }
        saveSettingsDebounced();
    }

    if (changed > 0) {
        toastr.success(tr('{count} message collapsed.|{count} messages collapsed.', 'mc.toast.allCollapsed', { count: changed }));
    } else {
        toastr.info(tr('All messages are already collapsed — nothing to collapse.', 'mc.toast.allAlreadyCollapsed'));
    }
}
