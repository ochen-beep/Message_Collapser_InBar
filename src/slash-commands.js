// @ts-check
/**
 * Message Collapser — Slash commands.
 * Registers /mc-collapse, /mc-expand, /mc-toggle (aliases /mcc, /mce, /mct)
 * through ST's SlashCommandParser. Skipped with a warning when the parser API
 * is unavailable, so older SillyTavern builds keep working without commands.
 */

import { getCtx, warn } from './core.js';
import { tr } from './i18n.js';
import {
    handleCollapseAllClick, handleExpandAllClick,
    handleCollapseHiddenClick, handleExpandHiddenClick,
    handleCollapseUserClick, handleExpandUserClick,
    handleCollapseCharacterClick, handleExpandCharacterClick,
    handleCollapseSystemClick, handleExpandSystemClick,
} from './bulk.js';
import { toggleMessageByMesId } from './collapse.js';

let _registered = false;

function resolveTarget(target, handlers) {
    const targetLower = target.toString().toLowerCase();
    if (targetLower === 'all') { handlers.all(); return; }
    if (targetLower === 'hidden') { handlers.hidden(); return; }
    if (targetLower === 'user') { handlers.user(); return; }
    if (targetLower === 'character' || targetLower === 'char') { handlers.character(); return; }
    if (targetLower === 'system') { handlers.system(); return; }
    toastr.error(tr('Unknown target for Message Collapser: {target}', 'mc.toast.unknownTarget', { target: targetLower }));
}

/** Register the /mc-* commands once per page load. Idempotent. */
export function registerSlashCommands() {
    if (_registered) return;
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = getCtx();
    if (!SlashCommandParser || !SlashCommand || !SlashCommandArgument || !ARGUMENT_TYPE) {
        warn('SlashCommandParser API not available; slash commands skipped.');
        return;
    }

    const targetArgument = SlashCommandArgument.fromProps({
        description: tr('target: all, hidden, user, character, system', 'mc.slash.targetDescription'),
        typeList: [ARGUMENT_TYPE.STRING],
        isRequired: true,
    });

    const mesIdArgument = SlashCommandArgument.fromProps({
        description: tr('message id (mesid)', 'mc.slash.mesidDescription'),
        typeList: [ARGUMENT_TYPE.NUMBER],
        isRequired: true,
    });

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
        helpString: tr('Collapse messages: /mc-collapse [all|hidden|user|character|system]', 'mc.slash.collapseHelp'),
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
        helpString: tr('Expand messages: /mc-expand [all|hidden|user|character|system]', 'mc.slash.expandHelp'),
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mc-toggle',
        callback: (_namedArgs, mesId) => {
            const id = parseInt(mesId.toString());
            if (Number.isNaN(id)) {
                toastr.error(tr('/mc-toggle requires a numeric mesid.', 'mc.toast.toggleRequiresNumber'));
                return '';
            }
            toggleMessageByMesId(id);
            return '';
        },
        aliases: ['mct'],
        unnamedArgumentList: [mesIdArgument],
        helpString: tr('Toggle message collapse by mesid: /mc-toggle <mesid>', 'mc.slash.toggleHelp'),
    }));

    _registered = true;
}
