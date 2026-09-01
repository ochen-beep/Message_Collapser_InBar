// i18n.js — translation helper for Message Collapser.
//
// In SillyTavern the real translations are loaded via manifest.json and
// exposed through getContext().t(). This helper wraps that API and applies
// placeholder substitution. If ST has no translation for a key (context
// unavailable, or it returns the key verbatim for an unsupported locale),
// we fall back to the Russian dictionary baked in below — matching the
// HTML source text, which ST also leaves as-is when untranslated.
//
// Keep FALLBACK_RU in sync with i18n/ru-ru.json; the translate.test.js
// drift guard fails if they diverge.
export const FALLBACK_RU = {
    "mc_settings_title": "Сворачивание сообщений",
    "mc_enable_label": "Включить сворачивание сообщений",
    "mc_section_view": "Вид",
    "mc_preview_mode_label": "Режим свёрнутого сообщения:",
    "mc_preview_mode_hide": "Скрыть полностью",
    "mc_preview_mode_preview": "Показать превью строк",
    "mc_preview_lines_label": "Строк превью:",
    "mc_section_auto": "Автоматика",
    "mc_auto_collapse_length_label": "Свернуть, если длиннее",
    "mc_auto_collapse_age_label": "Свернуть, если старше",
    "mc_chars_suffix": "символов",
    "mc_messages_suffix": "сообщений от конца",
    "mc_section_manual": "Ручное управление",
    "mc_target_all": "Все сообщения",
    "mc_target_hidden": "Скрытые из промпта",
    "mc_target_user": "Пользователь",
    "mc_target_character": "Персонаж",
    "mc_target_system": "Система",
    "mc_action_collapse": "Свернуть",
    "mc_action_expand": "Развернуть",
    "mc_toast_no_hidden_collapse": "Нет сообщений, скрытых из промпта, для сворачивания.",
    "mc_toast_no_hidden_expand": "Нет сообщений, скрытых из промпта, для разворачивания.",
    "mc_toast_hidden_collapsed": "{count} скрытое сообщение свёрнуто.|{count} скрытых сообщения свёрнуты.|{count} скрытых сообщений свёрнуто.",
    "mc_toast_no_sender_messages": "Нет сообщений отправителя {sender}.",
    "mc_toast_sender_collapsed": "{count} сообщение отправителя {sender} свёрнуто.|{count} сообщения отправителя {sender} свёрнуты.|{count} сообщений отправителя {sender} свёрнуто.",
    "mc_toast_all_expanded": "{count} сообщение развёрнуто.|{count} сообщения развёрнуты.|{count} сообщений развёрнуто.",
    "mc_toast_all_already_expanded": "Все сообщения уже развёрнуты или нечего разворачивать.",
    "mc_toast_all_collapsed": "{count} сообщение свёрнуто.|{count} сообщения свёрнуты.|{count} сообщений свёрнуто.",
    "mc_toast_all_already_collapsed": "Все сообщения уже свёрнуты или нечего сворачивать.",
    "mc_toast_message_not_found": "Сообщение с mesid {mesId} не найдено.",
    "mc_toast_toggle_requires_number": "/mc-toggle требует числовой mesid.",
    "mc_toast_unknown_target": "Неизвестная цель для Message Collapser: {target}",
    "mc_toast_load_error": "Не удалось загрузить UI Message Collapser. Подробности в консоли.",
    "mc_slash_target_description": "цель: all, hidden, user, character, system",
    "mc_slash_mesid_description": "идентификатор сообщения (mesid)",
    "mc_slash_collapse_help": "Свернуть сообщения: /mc-collapse [all|hidden|user|character|system]",
    "mc_slash_expand_help": "Развернуть сообщения: /mc-expand [all|hidden|user|character|system]",
    "mc_slash_toggle_help": "Переключить сворачивание сообщения по mesid: /mc-toggle <mesid>",
    "mc_arrow_title": "Свернуть или развернуть сообщение"
};

// Selects a plural form from a pipe-separated string.
// Russian (default): form0 (1), form1 (2-4), form2 (0,5-20,21,25-30...)
// English: form0 (1), form1 (other)
export function pluralize(count, forms, locale = 'ru') {
    const parts = forms.split('|');
    const n = Math.abs(count);
    if (locale === 'en') {
        return parts[n === 1 ? 0 : 1] ?? parts[0] ?? '';
    }
    // Russian-style three-form plural
    const last = n % 10;
    const lastTwo = n % 100;
    if (last === 1 && lastTwo !== 11) return parts[0] ?? '';
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return parts[1] ?? '';
    return parts[2] ?? parts[1] ?? parts[0] ?? '';
}

function replacePlaceholders(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (_match, name) => {
        return vars[name] !== undefined ? String(vars[name]) : `{${name}}`;
    });
}

function translate(value, vars) {
    if (!value) return null;
    if (value.includes('|') && vars && typeof vars.count === 'number') {
        return replacePlaceholders(pluralize(vars.count, value), vars);
    }
    return replacePlaceholders(value, vars);
}

export function t(key, vars) {
    // 1. Prefer ST's own translator when it yields a real translation.
    try {
        const context = globalThis.SillyTavern?.getContext?.();
        if (typeof context?.t === 'function') {
            const translated = context.t(key);
            // ST returns the key verbatim when no translation is registered
            // for the active locale — treat that as a miss and fall through.
            if (translated && translated !== key) {
                return translate(translated, vars) ?? key;
            }
        }
    } catch { /* ignore */ }

    // 2. Fall back to the baked-in Russian dictionary so JS-side strings
    //    (toastr, slash help, arrow title) behave like the HTML source text,
    //    which ST also leaves as Russian when untranslated.
    const fallback = translate(FALLBACK_RU[key], vars);
    if (fallback) return fallback;

    // 3. Last resort: the raw key.
    return key;
}
