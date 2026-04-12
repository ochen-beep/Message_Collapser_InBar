// The main script for the Message Collapser

import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Import from our new actions.js
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
    handleExpandDisabledClick
} from './actions.js';

const extensionName = "Message Collapser InBar";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Define default settings for the extension
const defaultSettings = {
    isEnabled: false,
};

// Function to get or initialize settings
function getSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = structuredClone(defaultSettings);
    }
    for (const key in defaultSettings) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
    return extension_settings[extensionName];
}

// Function to save settings
function saveSettings() {
    saveSettingsDebounced();
}

// Function to update the status indicator text in the settings panel
function updateStatusIndicator(isEnabled) {
    const statusSpan = $("#testExtensionStatusIndicator");
    if (statusSpan.length) {
        statusSpan.text(isEnabled ? "Enabled" : "Disabled");
    }
}

// Handler for the Master Enable/Disable toggle
function handleMasterEnableToggleChange(event) {
    const settings = getSettings();
    settings.isEnabled = Boolean($(event.target).prop("checked"));
    saveSettings();
    updateStatusIndicator(settings.isEnabled);
    console.log("Message Collapser is now: " + (settings.isEnabled ? 'Enabled' : 'Disabled'));

    if (settings.isEnabled) {
        addCollapseArrowsToMessages();
        autoCollapseHiddenMessages();
        startObserver();
    } else {
        removeCollapseArrowsFromMessages();
    }
}

// Main initialization function
jQuery(async () => {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings_panel.html`);
        $("#extensions_settings").append(settingsHtml);

        const settings = getSettings();

        $("#testExtensionMasterEnable").prop("checked", settings.isEnabled);
        updateStatusIndicator(settings.isEnabled);

        if (settings.isEnabled) {
            addCollapseArrowsToMessages();
            // ST грузит чат асинхронно, поэтому откладываем установку
            // начальных состояний на следующий тик — к тому моменту CSS уже применён
            // и MutationObserver успел добавить кнопки к сообщениям
            setTimeout(() => autoCollapseHiddenMessages(), 0);
            startObserver();
        }

        // Event Handlers
        $("#testExtensionMasterEnable").on("change", handleMasterEnableToggleChange);
        $("#testExtensionCollapseDisabled").on("click", handleCollapseDisabledClick);
        $("#testExtensionExpandDisabled").on("click", handleExpandDisabledClick);
        $("#testExtensionExpandAll").on("click", handleExpandAllClick);
        $("#testExtensionCollapseAll").on('click', handleCollapseAllClick);

        // Arrow click handler
        $(document).on('click', '.' + arrowClass, handleArrowClick);
    } catch (error) {
        console.error("Error loading Message Collapser settings HTML or initializing:", error);
        toastr.error("Failed to load Message Collapser UI. Check console for details.");
    }
});
