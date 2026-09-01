import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'settings_panel.html'), 'utf8');

describe('settings_panel.html', () => {
    it('has no status indicator', () => {
        assert.ok(!html.includes('mcStatusIndicator'), 'status indicator should be removed');
    });

    it('has sections for view, auto, and manual control', () => {
        assert.ok(html.includes('mc_section_view'));
        assert.ok(html.includes('mc_section_auto'));
        assert.ok(html.includes('mc_section_manual'));
    });

    it('uses text action buttons for manual actions', () => {
        assert.ok(html.includes('mc-text-btn'));
        assert.ok(!html.includes('fa-minus'), 'icon buttons should be replaced with text buttons');
        assert.ok(!html.includes('fa-plus'), 'icon buttons should be replaced with text buttons');
        const collapseMatches = html.match(/data-i18n="mc_action_collapse"/g) || [];
        const expandMatches = html.match(/data-i18n="mc_action_expand"/g) || [];
        assert.strictEqual(collapseMatches.length, 5, 'one collapse button per target (5 targets)');
        assert.strictEqual(expandMatches.length, 5, 'one expand button per target (5 targets)');
    });

    it('marks conditional fields with visibility classes', () => {
        assert.ok(html.includes('mc-preview-lines-field'));
        assert.ok(html.includes('mc-length-field'));
        assert.ok(html.includes('mc-age-field'));
    });

    it('wraps non-master settings in a dimmable body', () => {
        assert.ok(html.includes('mc-settings-body'));
    });

    it('uses data-i18n for all visible labels', () => {
        const matches = html.match(/data-i18n=/g) || [];
        assert.ok(matches.length >= 20, `expected at least 20 data-i18n attrs, got ${matches.length}`);
    });

    it('preserves all required element IDs', () => {
        const requiredIds = [
            'mcMasterEnable',
            'mcPreviewMode', 'mcPreviewLines',
            'mcAutoCollapseByLength', 'mcLengthThreshold',
            'mcAutoCollapseByAge', 'mcAgeThreshold',
            'mcCollapseAll', 'mcExpandAll',
            'mcCollapseHidden', 'mcExpandHidden',
            'mcCollapseUser', 'mcExpandUser',
            'mcCollapseCharacter', 'mcExpandCharacter',
            'mcCollapseSystem', 'mcExpandSystem',
        ];
        for (const id of requiredIds) {
            assert.ok(html.includes(`id="${id}"`), `missing required element #${id}`);
        }
    });

    it('hides decorative elements from assistive tech', () => {
        // Декоративные элементы: chevron панели, трек toggle, боксы чекбоксов, бейдж статуса
        const matches = html.match(/aria-hidden="true"/g) || [];
        assert.ok(matches.length >= 5, `expected at least 5 aria-hidden=true attrs, got ${matches.length}`);
    });

    it('every text action button carries a translatable label', () => {
        const buttonMatches = html.match(/class="menu_button mc-text-btn"/g) || [];
        const collapseMatches = html.match(/data-i18n="mc_action_collapse"/g) || [];
        const expandMatches = html.match(/data-i18n="mc_action_expand"/g) || [];
        assert.strictEqual(buttonMatches.length, 10, 'expected 10 text action buttons');
        assert.strictEqual(collapseMatches.length + expandMatches.length, buttonMatches.length,
            'every action button should have a data-i18n label');
    });

    it('associates every checkbox with a label', () => {
        const checkboxIds = ['mcMasterEnable', 'mcAutoCollapseByLength', 'mcAutoCollapseByAge'];
        for (const id of checkboxIds) {
            assert.ok(html.includes(`for="${id}"`), `checkbox #${id} should have an associated label`);
        }
    });
});
