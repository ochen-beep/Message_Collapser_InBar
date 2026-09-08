// @ts-check
/**
 * Message Collapser — Main entry point.
 * Lifecycle hooks + orchestrator. All behavior lives in src/; this file only
 * wires init/teardown and exposes the manifest hook surface.
 */

import { MODULE_NAME, LEGACY_MODULE_NAME, getCtx, getSettings, saveSettings, trace, error } from './src/core.js';
import { migrateSettingsKey } from './src/state.js';
import { tr } from './src/i18n.js';
import { mountSettingsPanel, unmountSettingsPanel } from './src/settings.js';
import { startObserver, onChatChanged, onChatDeleted, bindArrowHandlers, destroy } from './src/collapse.js';
import { registerSlashCommands } from './src/slash-commands.js';

// ── Lifecycle Hooks ──

let _initPromise = null;

// Coalesce concurrent starts (hooks + legacy bootstrap): one init run, and a
// failure clears the memo so a later start retries.
function startInit(label) {
    _initPromise ??= init().catch(e => {
        error(`${label} error:`, e);
        toastr.error(tr('Failed to load the Message Collapser UI. See the console for details.', 'mc.toast.loadError'));
        _initPromise = null;
    });
}

async function init() {
    // Must run before the first getSettings(): buildSettings would create a
    // fresh default key and shadow the legacy data.
    if (migrateSettingsKey(getCtx().extensionSettings, MODULE_NAME, LEGACY_MODULE_NAME)) {
        trace(`migrated settings key "${LEGACY_MODULE_NAME}" → "${MODULE_NAME}"`);
        saveSettings();
    }

    await mountSettingsPanel();

    const settings = getSettings();
    if (settings.isEnabled) {
        startObserver();
        // Already-loaded chat: in case CHAT_CHANGED fired before we could
        // subscribe.
        onChatChanged();
    }

    bindArrowHandlers();

    // Event-driven init / chat switch, and state cleanup on chat deletion.
    // removeListener-then-on guards against double subscription (ST's
    // EventEmitter has removeListener, no .off).
    const { eventSource, event_types } = getCtx();
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.removeListener(event_types.CHAT_DELETED, onChatDeleted);
    eventSource.on(event_types.CHAT_DELETED, onChatDeleted);

    registerSlashCommands();
}

// Full teardown: runtime, panel, event subscriptions. Slash commands stay
// registered (once per page load, no-op while disabled).
function cleanup() {
    try {
        const { eventSource, event_types } = getCtx();
        eventSource?.removeListener(event_types.CHAT_CHANGED, onChatChanged);
        eventSource?.removeListener(event_types.CHAT_DELETED, onChatDeleted);
    } catch { /* context gone — nothing to unsubscribe */ }
    destroy();
    unmountSettingsPanel();
    _initPromise = null;
}

/** Hook: extension activated (ST startup with the extension enabled, or re-activation). */
export function onActivate() {
    trace('onActivate: initializing…');
    startInit('init');
}

/** Hook: extension updated. Runs the settings-key migration, then init covers the rest lazily. */
export function onUpdate() {
    if (migrateSettingsKey(getCtx().extensionSettings, MODULE_NAME, LEGACY_MODULE_NAME)) {
        trace(`onUpdate: migrated settings key "${LEGACY_MODULE_NAME}" → "${MODULE_NAME}"`);
        saveSettings();
    }
}

/** Hook: extension re-enabled — re-initialize. */
export function onEnable() {
    trace('onEnable: re-initializing…');
    startInit('onEnable');
}

/** Hook: extension disabled — full cleanup. */
export function onDisable() {
    trace('onDisable: cleaning up…');
    cleanup();
}

/** Hook: extension uninstalled — cleanup + wipe persisted settings. */
export function onClean() {
    trace('onClean: cleaning up + clearing settings…');
    cleanup();
    delete getCtx().extensionSettings[MODULE_NAME];
    saveSettings();
}

// ── Legacy bootstrap ──
// ST builds without manifest-hook support never fire onActivate; start from
// the document-ready signal as well. startInit() coalesces concurrent calls,
// so a double start (hooks + ready) runs init once.
jQuery(async () => {
    startInit('jquery');
});
