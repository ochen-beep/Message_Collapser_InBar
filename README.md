# Message Collapser

A [SillyTavern](https://docs.sillytavern.app/) extension that adds a collapse toggle to every message's action bar — next to edit, copy, and the other buttons — instead of floating it outside the chat bubble. Collapsed messages hide their text (or show a short preview), and the choice survives reloads.

**English** · [Русский](USER_GUIDE.md)

> This extension is a substantial rework of [InspectorCaracal/Message_Collapser](https://github.com/InspectorCaracal/Message_Collapser). It interacts with [SillyTavern](https://github.com/SillyTavern/SillyTavern) (AGPL-3.0) through its public extension API and contains no SillyTavern code.

## Features

- **Chevron button in the action bar** — collapse or expand individual messages, keyboard-operable (`Tab` + `Enter`/`Space`, `aria-expanded`).
- **Prompt-hidden auto-collapse** — messages excluded from the prompt (eye icon) collapse automatically on chat load.
- **Preview mode** — show the first N lines of a collapsed message instead of hiding it completely.
- **Auto-collapse rules** — collapse messages longer than N chars or older than N messages from the end of the chat. Computed at render time, never persisted.
- **Bulk actions** — collapse/expand all, prompt-hidden only, or by sender (user / character / system), from the settings panel or slash commands.
- **Persistent manual state** — manual collapse/expand is saved per chat and restored on reload.
- **Master toggle** — disable the extension without uninstalling it.
- **Localized UI** — English base with a Russian translation.

## Requirements

- SillyTavern **1.12.0** or newer.

## Installation

### From a git repository

> Repository URL: **https://github.com/ochen-beep/SillyTavern-Message-Collapser**

1. Open **Extensions → Manage Extensions** in SillyTavern.
2. Paste the repository URL into the *Install extension* field and press **Install**.
3. Reload SillyTavern and make sure **Message Collapser** is enabled in the extensions list.

### Manual

1. Copy the release package contents (`manifest.json`, `index.js`, `style.css`, `settings.html`, `src/`, `USER_GUIDE.md`) into a new folder under `data/<user-handle>/extensions/`.
2. Restart SillyTavern, then enable **Message Collapser** in **Manage Extensions**.

## Usage

1. Open the **Message Collapser** block in the **Extensions** panel and enable it.
2. Use the chevron in any message's action bar to collapse or expand it.
3. Pick a collapsed display mode under **View**: hide completely, or show a configurable number of preview lines.
4. Optionally enable **Automation** rules: collapse messages over a length threshold, or older than N messages from the end of the chat.
5. Use **Manual control** for bulk actions: all messages, prompt-hidden only, or per sender.

## Slash Commands

Requires SillyTavern's SlashCommandParser API; skipped silently on builds without it.

- `/mc-collapse [all|hidden|user|character|system]` — collapse the target group
- `/mc-expand [all|hidden|user|character|system]` — expand the target group
- `/mc-toggle <mesid>` — toggle collapse for a specific message

Aliases: `/mcc`, `/mce`, `/mct`.

## Notes

- Manual collapse state is saved per chat and restored on reload. State is keyed by the message's `send_date` timestamp, which is stable across deletions and reordering — collapsing message #5 and then deleting an earlier message will not shift the collapse to the wrong message. Legacy positional-key data migrates lazily on chat load.
- Messages excluded from the prompt (eye icon) are auto-collapsed on chat load. This is independent of manual collapse state; use the eye icon to control prompt inclusion.
- **Collapse/Expand All** operate on every visible message but only persist manual state for non-hidden messages (hidden messages are governed by their own flag).
- **Auto-collapse rules** are computed at render time and are not persisted. If you manually expand a message that was auto-collapsed, it will stay expanded on next load (manual state overrides auto rules).
- A detailed Russian guide is available in [USER_GUIDE.md](USER_GUIDE.md).

## License

[AGPL-3.0](LICENSE)
