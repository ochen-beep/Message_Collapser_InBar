import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, pluralize } from '../i18n.js';

describe('pluralize', () => {
    it('selects singular form for count 1', () => {
        const result = pluralize(1, 'one|few|many');
        assert.strictEqual(result, 'one');
    });

    it('selects few form for count 2-4 in Russian-style', () => {
        assert.strictEqual(pluralize(2, 'one|few|many'), 'few');
        assert.strictEqual(pluralize(4, 'one|few|many'), 'few');
    });

    it('selects many form for count 5+ and 11-14', () => {
        assert.strictEqual(pluralize(5, 'one|few|many'), 'many');
        assert.strictEqual(pluralize(11, 'one|few|many'), 'many');
        assert.strictEqual(pluralize(21, 'one|few|many'), 'one');
    });

    it('selects by index for two-form strings', () => {
        assert.strictEqual(pluralize(1, 'one|many', 'en'), 'one');
        assert.strictEqual(pluralize(5, 'one|many', 'en'), 'many');
    });
});

describe('t', () => {
    it('falls back to Russian dictionary when ST context is unavailable', () => {
        delete globalThis.SillyTavern;
        const result = t('mc_toast_message_not_found', { mesId: 42 });
        assert.strictEqual(result, 'Сообщение с mesid 42 не найдено.');
    });

    it('uses ST context.t when available', () => {
        const contextT = mock.fn((key) => key === 'mc_toast_message_not_found' ? 'Message with mesid {mesId} not found.' : key);
        globalThis.SillyTavern = { getContext: () => ({ t: contextT }) };
        const result = t('mc_toast_message_not_found', { mesId: 42 });
        assert.strictEqual(result, 'Message with mesid 42 not found.');
        assert.strictEqual(contextT.mock.calls.length, 1);
        delete globalThis.SillyTavern;
    });

    it('replaces placeholders in ST-translated string', () => {
        globalThis.SillyTavern = { getContext: () => ({ t: () => 'Count: {count}' }) };
        const result = t('any.key', { count: 5 });
        assert.strictEqual(result, 'Count: 5');
        delete globalThis.SillyTavern;
    });

    it('selects plural form from ST-translated string when count is provided', () => {
        globalThis.SillyTavern = { getContext: () => ({ t: () => '{count} item|{count} items' }) };
        assert.strictEqual(t('any.key', { count: 1 }), '1 item');
        assert.strictEqual(t('any.key', { count: 5 }), '5 items');
        delete globalThis.SillyTavern;
    });

    it('falls back to Russian when ST returns the key untranslated', () => {
        // ST's t() returns the key verbatim when no translation is registered
        // for the active locale. We must not surface the raw key to the user.
        globalThis.SillyTavern = { getContext: () => ({ t: (key) => key }) };
        const result = t('mc_toast_unknown_target', { target: 'foo' });
        assert.strictEqual(result, 'Неизвестная цель для Message Collapser: foo');
        delete globalThis.SillyTavern;
    });

    it('selects Russian plural form through fallback when count is provided', () => {
        delete globalThis.SillyTavern;
        assert.strictEqual(
            t('mc_toast_all_collapsed', { count: 1 }),
            '1 сообщение свёрнуто.'
        );
        assert.strictEqual(
            t('mc_toast_all_collapsed', { count: 3 }),
            '3 сообщения свёрнуты.'
        );
        assert.strictEqual(
            t('mc_toast_all_collapsed', { count: 5 }),
            '5 сообщений свёрнуто.'
        );
    });

    it('returns the raw key when it is absent from both ST and the fallback', () => {
        delete globalThis.SillyTavern;
        assert.strictEqual(t('nonexistent_key_xyz'), 'nonexistent_key_xyz');
    });
});

// Drift guard: the fallback dictionary baked into i18n.js must stay in sync
// with i18n/ru-ru.json — same keys, same values. If someone edits one and
// forgets the other, JS strings (toastr, slash help) and HTML strings will
// diverge silently.
describe('fallback dictionary drift guard', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ruRu = JSON.parse(readFileSync(join(__dirname, '..', 'i18n', 'ru-ru.json'), 'utf8'));

    it('exposes a fallback dictionary with the same key set as ru-ru.json', async () => {
        const mod = await import('../i18n.js');
        assert.ok(mod.FALLBACK_RU, 'FALLBACK_RU must be exported for the drift guard');
        const jsonKeys = Object.keys(ruRu).sort();
        const fbKeys = Object.keys(mod.FALLBACK_RU).sort();
        assert.deepEqual(fbKeys, jsonKeys, 'fallback keys must match ru-ru.json exactly');
    });

    it('fallback values match ru-ru.json exactly', async () => {
        const mod = await import('../i18n.js');
        for (const [key, value] of Object.entries(ruRu)) {
            assert.equal(
                mod.FALLBACK_RU[key], value,
                `fallback value for ${key} diverges from ru-ru.json`
            );
        }
    });
});
