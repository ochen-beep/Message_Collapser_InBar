// @ts-check
/**
 * Message Collapser — i18n helper.
 *
 * SillyTavern loads the manifest-declared dictionaries (src/i18n/ru-ru.json)
 * and exposes a two-argument translate(fallback, key) on the context. This
 * module wraps that API: the first argument is the English source text (the
 * base language, matching the HTML source), the key is looked up in the
 * loaded dictionaries, and the result goes through placeholder substitution
 * and pipe-separated plural selection. When ST has no translation for the
 * active locale the fallback is returned as-is — the same way untranslated
 * data-i18n text stays English.
 */

import { getCtx } from './core.js';

/**
 * Select a plural form from a pipe-separated string by form count.
 * 2 forms (English): form0 (1), form1 (0, 2, 5…).
 * 3 forms (Russian): form0 (1, 21, 31…), form1 (2-4, 22-24…), form2 (0, 5-20…).
 * The form count decides the algorithm, so the same code path serves both the
 * English fallback (2 forms) and the Russian dictionary entry (3 forms).
 * @param {number} count
 * @param {string} forms
 */
export function pluralize(count, forms) {
    const parts = forms.split('|');
    const n = Math.abs(count);
    if (parts.length < 3) {
        return parts[n === 1 ? 0 : 1] ?? parts[0] ?? '';
    }
    const last = n % 10;
    const lastTwo = n % 100;
    if (last === 1 && lastTwo !== 11) return parts[0] ?? '';
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return parts[1] ?? '';
    return parts[2] ?? parts[1] ?? parts[0] ?? '';
}

/**
 * Replace {name} placeholders; unknown names stay verbatim for spotting.
 * @param {string} text
 * @param {Record<string, any> | undefined} vars
 */
function replacePlaceholders(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (_match, name) => {
        return vars[name] !== undefined ? String(vars[name]) : `{${name}}`;
    });
}

/**
 * Apply plural selection and placeholder substitution to a resolved string.
 * @param {string} value
 * @param {Record<string, any> | undefined} vars
 */
function interpolate(value, vars) {
    if (!value) return value;
    if (value.includes('|') && vars && typeof vars.count === 'number') {
        return replacePlaceholders(pluralize(vars.count, value), vars);
    }
    return replacePlaceholders(value, vars);
}

/**
 * Translate UI text through SillyTavern with an English fallback.
 * @param {string} fallback English source text (base language).
 * @param {string} key dictionary key, e.g. 'mc.toast.allCollapsed'.
 * @param {Record<string, any>} [vars] placeholder / count values.
 * @returns {string}
 */
export function tr(fallback, key, vars) {
    let text = fallback;
    try {
        const translated = getCtx()?.translate?.(fallback, key);
        if (translated !== undefined && translated !== null) text = String(translated);
    } catch { /* ST context not ready — English fallback */ }
    return interpolate(text, vars) ?? key;
}
