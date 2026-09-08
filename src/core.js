// @ts-check
/**
 * Message Collapser — Core module.
 * Constants, settings access, context/logging helpers. Everything else in src/
 * imports from here; core.js itself stays dependency-free except for the pure
 * state.js (one-way edge, safe against import cycles). ST services are always
 * reached through getCtx() — no deep relative imports, so loading works under
 * any install folder depth.
 */

import { buildSettings } from './state.js';

// Settings key under extension_settings. Renamed from the legacy
// 'Message_Collapser_InBar'; migrateSettingsKey() (state.js) carries old
// data over during init / onUpdate.
export const MODULE_NAME = 'message_collapser';
export const LEGACY_MODULE_NAME = 'Message_Collapser_InBar';
export const DISPLAY_NAME = 'Message Collapser';

// FOLDER_NAME is how ST addresses this extension on disk
// (scripts/extensions/third-party/<name>): a git install names the folder
// after the repository, not after display_name, so deriving it keeps
// renderExtensionTemplateAsync paths working under manual installs under any
// folder name.
const _url = new URL(import.meta.url);
const _path = decodeURIComponent(_url.pathname);
export const FOLDER_NAME = _path.substring(1).split('/').filter(Boolean).slice(0, -2).pop() || MODULE_NAME;

// DOM classes marking the collapse arrow and the collapsed/preview states.
// Kept long and unique on purpose: they are matched by delegated selectors on
// document (click/keydown) and by CSS, where a generic name could collide
// with other extensions.
export const arrowClass = 'message-collapser-arrow';
export const collapsedClass = 'message-collapser-message-collapsed';
export const previewClass = 'message-collapser-preview';

// jQuery event namespace for every handler this extension binds, so teardown
// is a single .off(namespace) and re-init never doubles listeners.
export const eventNamespace = '.mc';

// Collapsed-state source of truth is the CSS class (see style.css,
// .message-collapser-message-collapsed .mes_text { display:none !important }).
// No inline .hide()/.show(): the class is enough and avoids :visible reads.

/** SillyTavern context accessor. */
export function getCtx() {
    return SillyTavern.getContext();
}

// ── Settings ──

// Single access point to the extension settings with default-key backfill.
export function getSettings() {
    return buildSettings(getCtx().extensionSettings, MODULE_NAME);
}

/** Persist extension settings through ST's debounced saver. */
export function saveSettings() {
    getCtx()?.saveSettingsDebounced?.();
}

// ── Logging ──

const DEBUG = false; // verbose trace logging
export const trace = (...args) => { if (DEBUG) console.log(`[${DISPLAY_NAME}]`, ...args); };
export const log   = (...args) => console.log(`[${DISPLAY_NAME}]`, ...args);
export const warn  = (...args) => console.warn(`[${DISPLAY_NAME}]`, ...args);
export const error = (...args) => console.error(`[${DISPLAY_NAME}]`, ...args);
