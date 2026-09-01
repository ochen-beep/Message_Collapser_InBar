import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    defaultSettings,
    buildSettings,
    getStableMessageKey,
    isManuallyCollapsed,
    isManuallyExpanded,
    saveCollapsedState,
    saveManuallyExpandedState,
    saveManualToggleState,
    setMessagesBulkToggle,
    clearManualStateForChat,
    migrateLegacyCollapsedState,
    migratePositionalKeysIfNeeded,
} from '../state.js';

function makeMesElement(mesid) {
    return {
        getAttribute(name) {
            if (name === 'mesid') return String(mesid);
            return null;
        },
    };
}

describe('defaultSettings', () => {
    it('has the expected shape', () => {
        assert.deepEqual(defaultSettings, {
            isEnabled: false,
            collapsedMessages: {},
            manuallyExpandedMessages: {},
            previewMode: 'hide',
            previewLines: 2,
            autoCollapseByLength: false,
            lengthThreshold: 1000,
            autoCollapseByAge: false,
            ageThreshold: 20,
        });
    });

    it('is frozen', () => {
        assert.throws(() => { defaultSettings.isEnabled = true; });
    });
});

describe('buildSettings', () => {
    it('creates settings when missing', () => {
        const ext = {};
        const settings = buildSettings(ext, 'Message_Collapser_InBar');
        assert.equal(settings.isEnabled, false);
        assert.deepEqual(settings.collapsedMessages, {});
        assert.equal(ext.Message_Collapser_InBar, settings);
    });

    it('fills missing keys without overwriting existing ones', () => {
        const ext = { Message_Collapser_InBar: { isEnabled: true } };
        const settings = buildSettings(ext, 'Message_Collapser_InBar');
        assert.equal(settings.isEnabled, true);
        assert.deepEqual(settings.collapsedMessages, {});
    });

    it('does not replace an existing object value', () => {
        const existing = { chat1: { '123': true } };
        const ext = { Message_Collapser_InBar: { collapsedMessages: existing } };
        const settings = buildSettings(ext, 'Message_Collapser_InBar');
        assert.equal(settings.collapsedMessages, existing);
    });
});

describe('getStableMessageKey', () => {
    it('returns send_date as string for a valid mesid', () => {
        const chat = [{ send_date: 1000 }, { send_date: 2000 }];
        const key = getStableMessageKey(chat, makeMesElement(1));
        assert.equal(key, '2000');
    });

    it('returns null for missing mesid attribute', () => {
        const chat = [{ send_date: 1000 }];
        const el = { getAttribute: () => null };
        assert.equal(getStableMessageKey(chat, el), null);
    });

    it('returns null for non-numeric mesid', () => {
        const chat = [{ send_date: 1000 }];
        const el = makeMesElement('abc');
        assert.equal(getStableMessageKey(chat, el), null);
    });

    it('returns null when chat entry lacks send_date', () => {
        const chat = [{ mes: 'no date' }];
        assert.equal(getStableMessageKey(chat, makeMesElement(0)), null);
    });

    it('returns null when chat array is undefined', () => {
        assert.equal(getStableMessageKey(undefined, makeMesElement(0)), null);
    });
});

describe('isManuallyCollapsed', () => {
    const collapsedMessages = {
        chat1: { '1000': true, '2000': true },
    };

    it('returns true for a saved key', () => {
        assert.equal(isManuallyCollapsed(collapsedMessages, 'chat1', '1000'), true);
    });

    it('returns false for an unknown key', () => {
        assert.equal(isManuallyCollapsed(collapsedMessages, 'chat1', '9999'), false);
    });

    it('returns false for an unknown chat', () => {
        assert.equal(isManuallyCollapsed(collapsedMessages, 'chat2', '1000'), false);
    });

    it('returns false when key is null/empty', () => {
        assert.equal(isManuallyCollapsed(collapsedMessages, 'chat1', null), false);
        assert.equal(isManuallyCollapsed(collapsedMessages, 'chat1', ''), false);
    });

    it('returns false when collapsedMessages is undefined', () => {
        assert.equal(isManuallyCollapsed(undefined, 'chat1', '1000'), false);
    });
});

describe('saveCollapsedState', () => {
    it('adds a collapsed key and returns true', () => {
        const settings = { collapsedMessages: {} };
        const changed = saveCollapsedState(settings, 'chat1', '1000', true);
        assert.equal(changed, true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
    });

    it('returns false when collapsing an already-collapsed key', () => {
        const settings = { collapsedMessages: { chat1: { '1000': true } } };
        const changed = saveCollapsedState(settings, 'chat1', '1000', true);
        assert.equal(changed, false);
    });

    it('removes a key and returns true', () => {
        const settings = { collapsedMessages: { chat1: { '1000': true } } };
        const changed = saveCollapsedState(settings, 'chat1', '1000', false);
        assert.equal(changed, true);
        assert.equal('1000' in settings.collapsedMessages.chat1, false);
    });

    it('returns false when expanding a non-collapsed key', () => {
        const settings = { collapsedMessages: { chat1: {} } };
        const changed = saveCollapsedState(settings, 'chat1', '1000', false);
        assert.equal(changed, false);
    });

    it('initializes missing structures', () => {
        const settings = {};
        saveCollapsedState(settings, 'chat1', '1000', true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
    });

    it('returns false and does nothing without chatId or key', () => {
        const settings = { collapsedMessages: {} };
        assert.equal(saveCollapsedState(settings, null, '1000', true), false);
        assert.equal(saveCollapsedState(settings, 'chat1', null, true), false);
    });
});

describe('isManuallyExpanded', () => {
    const expandedMessages = {
        chat1: { '1000': true },
    };

    it('returns true for a saved expanded key', () => {
        assert.equal(isManuallyExpanded(expandedMessages, 'chat1', '1000'), true);
    });

    it('returns false for unknown key/chat', () => {
        assert.equal(isManuallyExpanded(expandedMessages, 'chat1', '9999'), false);
        assert.equal(isManuallyExpanded(expandedMessages, 'chat2', '1000'), false);
    });

    it('returns false when key is null', () => {
        assert.equal(isManuallyExpanded(expandedMessages, 'chat1', null), false);
    });
});

describe('saveManuallyExpandedState', () => {
    it('adds an expanded key and returns true', () => {
        const settings = {};
        const changed = saveManuallyExpandedState(settings, 'chat1', '1000', true);
        assert.equal(changed, true);
        assert.equal(settings.manuallyExpandedMessages.chat1['1000'], true);
    });

    it('removes an expanded key and returns true', () => {
        const settings = { manuallyExpandedMessages: { chat1: { '1000': true } } };
        const changed = saveManuallyExpandedState(settings, 'chat1', '1000', false);
        assert.equal(changed, true);
        assert.equal('1000' in settings.manuallyExpandedMessages.chat1, false);
    });
});

describe('saveManualToggleState', () => {
    it('marks collapsed and clears expanded', () => {
        const settings = {
            collapsedMessages: {},
            manuallyExpandedMessages: { chat1: { '1000': true } },
        };
        const changed = saveManualToggleState(settings, 'chat1', '1000', true);
        assert.equal(changed, true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
        assert.equal('1000' in settings.manuallyExpandedMessages.chat1, false);
    });

    it('marks expanded and clears collapsed', () => {
        const settings = {
            collapsedMessages: { chat1: { '1000': true } },
            manuallyExpandedMessages: {},
        };
        const changed = saveManualToggleState(settings, 'chat1', '1000', false);
        assert.equal(changed, true);
        assert.equal('1000' in settings.collapsedMessages.chat1, false);
        assert.equal(settings.manuallyExpandedMessages.chat1['1000'], true);
    });
});

describe('setMessagesBulkToggle', () => {
    it('bulk-collapse: adds matching keys to collapsed and returns true', () => {
        const settings = { collapsedMessages: {}, manuallyExpandedMessages: {} };
        const changed = setMessagesBulkToggle(settings, 'chat1', ['1000', '2000'], true);
        assert.equal(changed, true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
        assert.equal(settings.collapsedMessages.chat1['2000'], true);
    });

    // Bug A regression: expand must remove the key from collapsedMessages,
    // otherwise shouldCollapseMessage (collapsed > expanded priority) re-collapses
    // on the next onChatChanged.
    it('bulk-expand: removes matching keys from collapsedMessages (Bug A)', () => {
        const settings = {
            collapsedMessages: { chat1: { '1000': true, '2000': true } },
            manuallyExpandedMessages: {},
        };
        const changed = setMessagesBulkToggle(settings, 'chat1', ['1000'], false);
        assert.equal(changed, true);
        assert.equal('1000' in settings.collapsedMessages.chat1, false);
        assert.equal(settings.manuallyExpandedMessages.chat1['1000'], true);
        // untouched sibling stays collapsed
        assert.equal(settings.collapsedMessages.chat1['2000'], true);
    });

    // Bug B regression: collapse-by-sender must remove ONLY matching keys from
    // manuallyExpanded — not the whole chat's expanded map (which nukes other
    // senders' manual expansions).
    it('bulk-collapse: removes only matching keys from manuallyExpanded (Bug B)', () => {
        const settings = {
            collapsedMessages: {},
            // '3000' belongs to another sender the user manually expanded.
            manuallyExpandedMessages: { chat1: { '1000': true, '3000': true } },
        };
        setMessagesBulkToggle(settings, 'chat1', ['1000', '2000'], true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
        assert.equal(settings.collapsedMessages.chat1['2000'], true);
        assert.equal('1000' in settings.manuallyExpandedMessages.chat1, false);
        // other sender's expansion survives
        assert.equal(settings.manuallyExpandedMessages.chat1['3000'], true);
    });

    it('returns false when nothing changes', () => {
        const settings = {
            collapsedMessages: { chat1: { '1000': true } },
            manuallyExpandedMessages: {},
        };
        const changed = setMessagesBulkToggle(settings, 'chat1', ['1000'], true);
        assert.equal(changed, false);
    });

    it('skips null/empty keys', () => {
        const settings = { collapsedMessages: {}, manuallyExpandedMessages: {} };
        const changed = setMessagesBulkToggle(settings, 'chat1', ['1000', null, '', '2000'], true);
        assert.equal(changed, true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
        assert.equal(settings.collapsedMessages.chat1['2000'], true);
        assert.equal(Object.keys(settings.collapsedMessages.chat1).length, 2);
    });

    it('does not touch other chats', () => {
        const settings = {
            collapsedMessages: { chat2: { '9000': true } },
            manuallyExpandedMessages: { chat2: { '9000': false } },
        };
        setMessagesBulkToggle(settings, 'chat1', ['1000'], true);
        // chat2 untouched
        assert.equal(settings.collapsedMessages.chat2['9000'], true);
        // chat1 created and populated
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
    });

    it('initializes missing structures and guards null chatId/keys', () => {
        const settings = {};
        assert.equal(setMessagesBulkToggle(settings, null, ['1000'], true), false);
        assert.equal(setMessagesBulkToggle(settings, 'chat1', [], true), false);
        setMessagesBulkToggle(settings, 'chat1', ['1000'], true);
        assert.equal(settings.collapsedMessages.chat1['1000'], true);
        assert.ok(settings.manuallyExpandedMessages.chat1);
    });
});

describe('clearManualStateForChat', () => {
    it('clears both collapsed and expanded state for a chat', () => {
        const settings = {
            collapsedMessages: { chat1: { '1000': true }, chat2: { '2000': true } },
            manuallyExpandedMessages: { chat1: { '3000': true }, chat2: { '4000': true } },
        };
        const changed = clearManualStateForChat(settings, 'chat1');
        assert.equal(changed, true);
        assert.equal(settings.collapsedMessages.chat1, undefined);
        assert.equal(settings.manuallyExpandedMessages.chat1, undefined);
        assert.equal(settings.collapsedMessages.chat2['2000'], true);
        assert.equal(settings.manuallyExpandedMessages.chat2['4000'], true);
    });

    it('returns false when chat has no state', () => {
        const settings = { collapsedMessages: {}, manuallyExpandedMessages: {} };
        assert.equal(clearManualStateForChat(settings, 'chat1'), false);
    });
});

describe('migrateLegacyCollapsedState', () => {
    it('converts arrays to object maps', () => {
        const collapsedMessages = {
            chat1: ['1', '2', '3'],
            chat2: { '4': true },
        };
        const migrated = migrateLegacyCollapsedState(collapsedMessages);
        assert.equal(migrated, true);
        assert.deepEqual(collapsedMessages.chat1, { '1': true, '2': true, '3': true });
        assert.deepEqual(collapsedMessages.chat2, { '4': true });
    });

    it('returns false when nothing needs migration', () => {
        const collapsedMessages = {
            chat1: { '1': true },
        };
        assert.equal(migrateLegacyCollapsedState(collapsedMessages), false);
    });

    it('returns false for null/undefined input', () => {
        assert.equal(migrateLegacyCollapsedState(null), false);
        assert.equal(migrateLegacyCollapsedState(undefined), false);
    });
});

describe('migratePositionalKeysIfNeeded', () => {
    it('converts numeric mesid keys to send_date keys', () => {
        const collapsedMessages = {
            chat1: { '0': true, '2': true },
        };
        const chat = [
            { send_date: 1000 },
            { send_date: 2000 },
            { send_date: 3000 },
        ];
        const migrated = migratePositionalKeysIfNeeded(collapsedMessages, chat, 'chat1');
        assert.equal(migrated, true);
        assert.deepEqual(collapsedMessages.chat1, { '1000': true, '3000': true });
    });

    it('drops only positional keys that lack send_date, preserving non-positional numeric keys', () => {
        const collapsedMessages = {
            chat1: { '0': true, '99': true },
        };
        const chat = [{ send_date: 1000 }];
        migratePositionalKeysIfNeeded(collapsedMessages, chat, 'chat1');
        // '0' is a valid mesid → migrated to send_date '1000'.
        // '99' is not a valid positional index (>= chat.length), so treated as
        // an already-migrated send_date key and preserved.
        assert.deepEqual(collapsedMessages.chat1, { '1000': true, '99': true });
    });

    it('returns false when no positional keys exist (send_date keys preserved)', () => {
        const collapsedMessages = {
            chat1: { '1000': true },
        };
        const chat = [{ send_date: 1000 }];
        const migrated = migratePositionalKeysIfNeeded(collapsedMessages, chat, 'chat1');
        assert.equal(migrated, false);
        assert.deepEqual(collapsedMessages.chat1, { '1000': true });
    });

    it('preserves existing send_date keys while migrating positional keys', () => {
        const collapsedMessages = {
            chat1: { '0': true, '2000': true },
        };
        const chat = [
            { send_date: 1000 },
            { send_date: 2000 },
        ];
        migratePositionalKeysIfNeeded(collapsedMessages, chat, 'chat1');
        assert.deepEqual(collapsedMessages.chat1, { '1000': true, '2000': true });
    });

    it('returns false when chat or map is missing', () => {
        const collapsedMessages = { chat1: { '0': true } };
        assert.equal(migratePositionalKeysIfNeeded(collapsedMessages, null, 'chat1'), false);
        assert.equal(migratePositionalKeysIfNeeded(undefined, [{ send_date: 1 }], 'chat1'), false);
    });
});
