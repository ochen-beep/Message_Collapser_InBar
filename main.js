import { getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import { t } from './i18n.js';

import {
    extensionName,
    arrowClass,
    eventNamespace,
    getSettings,
    migrateLegacyCollapsedState,
    destroy,
    startObserver,
    handleArrowClick,
    handleArrowKeydown,
    handleCollapseAllClick,
    handleExpandAllClick,
    handleCollapseHiddenClick,
    handleExpandHiddenClick,
    handleCollapseUserClick,
    handleExpandUserClick,
    handleCollapseCharacterClick,
    handleExpandCharacterClick,
    handleCollapseSystemClick,
    handleExpandSystemClick,
    toggleMessageByMesId,
    onChatChanged,
    onChatDeleted
} from './actions.js';

// CSS-переменная управляет количеством строк в режиме предпросмотра.
// Выставляем на :root, чтобы действовала на все сообщения расширения.
function applyPreviewLines(previewLines) {
    const lines = Number.isFinite(previewLines) && previewLines > 0 ? previewLines : 2;
    document.documentElement.style.setProperty('--mc-preview-lines', String(lines));
}

function loadSettingsIntoUi(settings) {
    $("#mcMasterEnable").prop("checked", settings.isEnabled);

    $("#mcPreviewMode").val(settings.previewMode || 'hide');
    $("#mcPreviewLines").val(settings.previewLines ?? 2);
    applyPreviewLines(settings.previewLines);

    $("#mcAutoCollapseByLength").prop("checked", Boolean(settings.autoCollapseByLength));
    $("#mcLengthThreshold").val(settings.lengthThreshold ?? 1000);

    $("#mcAutoCollapseByAge").prop("checked", Boolean(settings.autoCollapseByAge));
    $("#mcAgeThreshold").val(settings.ageThreshold ?? 20);
}

function handleMasterEnableToggleChange(event) {
    const settings = getSettings();
    settings.isEnabled = Boolean($(event.target).prop("checked"));
    saveSettingsDebounced();

    if (settings.isEnabled) {
        startObserver();
        onChatChanged();
    } else {
        destroy();
    }
}

function handlePreviewModeChange(event) {
    const settings = getSettings();
    settings.previewMode = $(event.target).val();
    saveSettingsDebounced();
    onChatChanged();
}

function handlePreviewLinesChange(event) {
    const settings = getSettings();
    const value = parseInt($(event.target).val());
    settings.previewLines = Number.isNaN(value) ? 2 : Math.max(1, Math.min(10, value));
    applyPreviewLines(settings.previewLines);
    saveSettingsDebounced();
    onChatChanged();
}

function handleAutoCollapseByLengthChange(event) {
    const settings = getSettings();
    settings.autoCollapseByLength = Boolean($(event.target).prop("checked"));
    saveSettingsDebounced();
    onChatChanged();
}

function handleLengthThresholdChange(event) {
    const settings = getSettings();
    const value = parseInt($(event.target).val());
    settings.lengthThreshold = Number.isNaN(value) ? 1000 : Math.max(100, value);
    saveSettingsDebounced();
    onChatChanged();
}

function handleAutoCollapseByAgeChange(event) {
    const settings = getSettings();
    settings.autoCollapseByAge = Boolean($(event.target).prop("checked"));
    saveSettingsDebounced();
    onChatChanged();
}

function handleAgeThresholdChange(event) {
    const settings = getSettings();
    const value = parseInt($(event.target).val());
    settings.ageThreshold = Number.isNaN(value) ? 20 : Math.max(1, value);
    saveSettingsDebounced();
    onChatChanged();
}

// Регистрация слэш-команд.
function registerSlashCommands() {
    const context = getContext();
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = context;
    if (!SlashCommandParser || !SlashCommand || !SlashCommandArgument || !ARGUMENT_TYPE) {
        console.warn('Message Collapser: SlashCommandParser API not available; slash commands skipped.');
        return;
    }

    const targetArgument = SlashCommandArgument.fromProps({
        description: t('mc_slash_target_description'),
        typeList: [ARGUMENT_TYPE.STRING],
        isRequired: true,
    });

    const mesIdArgument = SlashCommandArgument.fromProps({
        description: t('mc_slash_mesid_description'),
        typeList: [ARGUMENT_TYPE.NUMBER],
        isRequired: true,
    });

    function resolveTarget(target, handlers) {
        const targetLower = target.toString().toLowerCase();
        if (targetLower === 'all') { handlers.all(); return; }
        if (targetLower === 'hidden') { handlers.hidden(); return; }
        if (targetLower === 'user') { handlers.user(); return; }
        if (targetLower === 'character' || targetLower === 'char') { handlers.character(); return; }
        if (targetLower === 'system') { handlers.system(); return; }
        toastr.error(t('mc_toast_unknown_target', { target: targetLower }));
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mc-collapse',
        callback: (_namedArgs, target) => {
            resolveTarget(target, {
                all: handleCollapseAllClick,
                hidden: handleCollapseHiddenClick,
                user: handleCollapseUserClick,
                character: handleCollapseCharacterClick,
                system: handleCollapseSystemClick,
            });
            return '';
        },
        aliases: ['mcc'],
        unnamedArgumentList: [targetArgument],
        helpString: t('mc_slash_collapse_help'),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mc-expand',
        callback: (_namedArgs, target) => {
            resolveTarget(target, {
                all: handleExpandAllClick,
                hidden: handleExpandHiddenClick,
                user: handleExpandUserClick,
                character: handleExpandCharacterClick,
                system: handleExpandSystemClick,
            });
            return '';
        },
        aliases: ['mce'],
        unnamedArgumentList: [targetArgument],
        helpString: t('mc_slash_expand_help'),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mc-toggle',
        callback: (_namedArgs, mesId) => {
            const id = parseInt(mesId.toString());
            if (Number.isNaN(id)) {
                toastr.error(t('mc_toast_toggle_requires_number'));
                return '';
            }
            toggleMessageByMesId(id);
            return '';
        },
        aliases: ['mct'],
        unnamedArgumentList: [mesIdArgument],
        helpString: t('mc_slash_toggle_help'),
    }));
}

// Регистрация всех DOM-обработчиков в одном месте, с namespace-префиксом.
// .off(ns) перед .on позволяет безопасно повторно инициализироваться, не
// удваивая слушателей (защита от повторного вызова entry-point).
function bindHandlers() {
    $(document).off('click' + eventNamespace, '.' + arrowClass)
               .on('click' + eventNamespace, '.' + arrowClass, handleArrowClick);
    $(document).off('keydown' + eventNamespace, '.' + arrowClass)
               .on('keydown' + eventNamespace, '.' + arrowClass, handleArrowKeydown);

    const ns = eventNamespace;
    $("#mcMasterEnable").off('change' + ns).on('change' + ns, handleMasterEnableToggleChange);

    $("#mcPreviewMode").off('change' + ns).on('change' + ns, handlePreviewModeChange);
    $("#mcPreviewLines").off('change' + ns).on('change' + ns, handlePreviewLinesChange);

    $("#mcAutoCollapseByLength").off('change' + ns).on('change' + ns, handleAutoCollapseByLengthChange);
    $("#mcLengthThreshold").off('change' + ns).on('change' + ns, handleLengthThresholdChange);

    $("#mcAutoCollapseByAge").off('change' + ns).on('change' + ns, handleAutoCollapseByAgeChange);
    $("#mcAgeThreshold").off('change' + ns).on('change' + ns, handleAgeThresholdChange);

    $("#mcCollapseHidden").off('click' + ns).on('click' + ns, handleCollapseHiddenClick);
    $("#mcExpandHidden").off('click' + ns).on('click' + ns, handleExpandHiddenClick);
    $("#mcExpandAll").off('click' + ns).on('click' + ns, handleExpandAllClick);
    $("#mcCollapseAll").off('click' + ns).on('click' + ns, handleCollapseAllClick);

    $("#mcCollapseUser").off('click' + ns).on('click' + ns, handleCollapseUserClick);
    $("#mcExpandUser").off('click' + ns).on('click' + ns, handleExpandUserClick);
    $("#mcCollapseCharacter").off('click' + ns).on('click' + ns, handleCollapseCharacterClick);
    $("#mcExpandCharacter").off('click' + ns).on('click' + ns, handleExpandCharacterClick);
    $("#mcCollapseSystem").off('click' + ns).on('click' + ns, handleCollapseSystemClick);
    $("#mcExpandSystem").off('click' + ns).on('click' + ns, handleExpandSystemClick);
}

jQuery(async () => {
    try {
        const { renderExtensionTemplateAsync } = getContext();
        const settingsHtml = await renderExtensionTemplateAsync(
            `third-party/${extensionName}`,
            'settings_panel'
        );
        // Если панель уже вставлена (повторная инициализация), не дублируем.
        if ($("#mcMasterEnable").length === 0) {
            $("#extensions_settings").append(settingsHtml);
        }

        const settings = getSettings();
        migrateLegacyCollapsedState();
        const { eventSource, event_types } = getContext();

        loadSettingsIntoUi(settings);

        if (settings.isEnabled) {
            startObserver();
            // Уже загруженный чат: на случай если CHAT_CHANGED отстрелил до того,
            // как мы повесили слушателя.
            onChatChanged();
        }

        bindHandlers();

        // Событийно-управляемая инициализация/смена чата и очистка состояния при
        // удалении чата. removeListener-then-on — гарантия от двойного подписания
        // (EventEmitter ST не имеет .off, только removeListener; .on — есть).
        eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
        eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
        eventSource.removeListener(event_types.CHAT_DELETED, onChatDeleted);
        eventSource.on(event_types.CHAT_DELETED, onChatDeleted);

        registerSlashCommands();
    } catch (error) {
        console.error("Error loading Message Collapser settings HTML or initializing:", error);
        toastr.error(t('mc_toast_load_error'));
    }
});
