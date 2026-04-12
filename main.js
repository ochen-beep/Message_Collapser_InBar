// main.js - Message Collapser InBar
// Entry point: settings, ST event subscriptions, UI wiring.

import {
    arrowClass,
    addCollapseArrowsToMessages,
    removeCollapseArrowsFromMessages,
    restoreAndAutoCollapse,
    startObserver,
    stopObserver,
    handleArrowClick,
    handleCollapseAllClick,
    handleExpandAllClick,
    handleCollapseDisabledClick,
    handleExpandDisabledClick,
} from './actions.js';

const extensionName       = 'Message_Collapser_InBar';
const extensionFolderPath = 'scripts/extensions/third-party/' + extensionName;

const defaultSettings = {
    isEnabled: false,
};

// --- Settings helpers --------------------------------------------------------

function getSettings() {
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

// --- UI helpers --------------------------------------------------------------

function setActionButtonsDisabled(disabled) {
    $('#mc-inbar-collapse-all, #mc-inbar-expand-all, #mc-inbar-collapse-disabled, #mc-inbar-expand-disabled')
        .prop('disabled', disabled);
}

// --- Event handlers ----------------------------------------------------------

function handleMasterEnableToggleChange(event) {
    const settings = getSettings();
    settings.isEnabled = Boolean($(event.target).prop('checked'));
    saveSettings();
    setActionButtonsDisabled(!settings.isEnabled);

    if (settings.isEnabled) {
        addCollapseArrowsToMessages();
        restoreAndAutoCollapse();
        startObserver();
    } else {
        stopObserver();
        removeCollapseArrowsFromMessages();
    }
}

// --- Initialization ----------------------------------------------------------

jQuery(async () => {
    const { eventSource, event_types } = SillyTavern.getContext();

    try {
        const settingsHtml = await $.get(extensionFolderPath + '/settings_panel.html');
        $('#extensions_settings').append(settingsHtml);
    } catch (error) {
        console.error('[Message Collapser] Failed to load settings HTML:', error);
        toastr.error('Message Collapser: cannot load settings panel.');
        return;
    }

    const settings = getSettings();
    $('#mc-inbar-master-enable').prop('checked', settings.isEnabled);
    setActionButtonsDisabled(!settings.isEnabled);

    // Panel button handlers
    $('#mc-inbar-master-enable')       .on('change', handleMasterEnableToggleChange);
    $('#mc-inbar-collapse-disabled')   .on('click',  handleCollapseDisabledClick);
    $('#mc-inbar-expand-disabled')     .on('click',  handleExpandDisabledClick);
    $('#mc-inbar-expand-all')          .on('click',  handleExpandAllClick);
    $('#mc-inbar-collapse-all')        .on('click',  handleCollapseAllClick);

    // Delegated handler — works for dynamically added arrows too
    $(document).on('click', '.' + arrowClass, handleArrowClick);

    // APP_READY: chat is fully loaded and rendered.
    // Fires synchronously if ST is already ready at subscribe time.
    eventSource.on(event_types.APP_READY, () => {
        if (!getSettings().isEnabled) return;
        addCollapseArrowsToMessages();
        restoreAndAutoCollapse();   // restore saved + auto-collapse excluded
        startObserver();
    });

    // CHAT_CHANGED: ST re-creates the entire .mes list.
    // We re-inject arrows and restore state after a short render delay.
    eventSource.on(event_types.CHAT_CHANGED, () => {
        if (!getSettings().isEnabled) return;
        setTimeout(() => {
            addCollapseArrowsToMessages();
            restoreAndAutoCollapse();   // <-- restores manual collapses from metadata
        }, 150);
    });
});
