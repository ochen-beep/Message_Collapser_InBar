import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ru from '../i18n/ru-ru.json' with { type: 'json' };
import en from '../i18n/en-us.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('i18n files', () => {
    it('ru-ru.json exists and is valid JSON', () => {
        const path = join(root, 'i18n', 'ru-ru.json');
        assert.strictEqual(existsSync(path), true, 'ru-ru.json should exist');
        const content = readFileSync(path, 'utf8');
        const parsed = JSON.parse(content);
        assert.strictEqual(typeof parsed, 'object');
        assert.strictEqual(parsed.mc_settings_title, 'Сворачивание сообщений');
    });

    it('ru-ru.json keys are non-empty strings and use mc_ prefix', () => {
        const path = join(root, 'i18n', 'ru-ru.json');
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        for (const [key, value] of Object.entries(parsed)) {
            assert.ok(key.startsWith('mc_'), `key ${key} should start with mc_`);
            assert.strictEqual(typeof value, 'string', `value for ${key} should be string`);
            assert.ok(value.length > 0, `value for ${key} should not be empty`);
        }
    });

    it('ru-ru.json plural-form keys have exactly three forms', () => {
        const path = join(root, 'i18n', 'ru-ru.json');
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        const pluralKeys = [
            'mc_toast_hidden_collapsed',
            'mc_toast_sender_collapsed',
            'mc_toast_all_expanded',
            'mc_toast_all_collapsed',
        ];
        for (const key of pluralKeys) {
            assert.ok(key in parsed, `key ${key} should exist`);
            const parts = parsed[key].split('|');
            assert.strictEqual(parts.length, 3, `key ${key} should have exactly 3 plural forms`);
            for (const part of parts) {
                assert.ok(part.includes('{count}'), `form in ${key} should include {count}`);
            }
        }
    });
});

describe('locale parity', () => {
    it('en-us.json has the same keys as ru-ru.json', () => {
        const ruKeys = Object.keys(ru).sort();
        const enKeys = Object.keys(en).sort();
        assert.deepStrictEqual(enKeys, ruKeys);
    });

    it('en-us.json values are non-empty strings', () => {
        for (const key of Object.keys(en)) {
            assert.strictEqual(typeof en[key], 'string');
            assert.ok(en[key].length > 0, `en-us.json key ${key} is empty`);
        }
    });
});

describe('i18n key coverage', () => {
    const html = readFileSync(join(root, 'settings_panel.html'), 'utf8');
    const mainJs = readFileSync(join(root, 'main.js'), 'utf8');
    const actionsJs = readFileSync(join(root, 'actions.js'), 'utf8');

    const extractKeys = (text) => {
        const keys = new Set();
        // data-i18n="key" or data-i18n="[attr]key" or data-i18n="[attr]key;[attr2]key2"
        for (const match of text.matchAll(/data-i18n="([^"]+)"/g)) {
            const value = match[1];
            // Each segment may be "[attr]key" or "key"
            const segments = value.split(';');
            for (const segment of segments) {
                const clean = segment.trim();
                const bracketEnd = clean.indexOf(']');
                const key = bracketEnd !== -1 ? clean.slice(bracketEnd + 1) : clean;
                keys.add(key);
            }
        }
        // t('key') or t("key"); avoid matching method names like .closest('.mes')
        for (const match of text.matchAll(/(?<![\w.])t\(['"]([^'"]+)['"]/g)) {
            keys.add(match[1]);
        }
        return keys;
    };

    it('all used i18n keys exist in ru-ru.json', () => {
        const used = new Set([
            ...extractKeys(html),
            ...extractKeys(mainJs),
            ...extractKeys(actionsJs),
        ]);
        const missing = [...used].filter((key) => !(key in ru));
        assert.deepStrictEqual(missing, []);
    });
});
