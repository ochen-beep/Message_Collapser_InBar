# Message Collapser InBar

SillyTavern extension. Adds a collapse button inside the message action bar — next to edit, copy, and other buttons — instead of floating it outside the chat bubble.

Fork of [InspectorCaracal/Message_Collapser](https://github.com/InspectorCaracal/Message_Collapser).

## Installation

Extensions → Install extension from URL → `https://github.com/ochen-beep/Message_Collapser_InBar`

## Usage

- **Chevron button** in the action bar — collapse or expand individual messages
- **Auto-collapse on load** — messages excluded from the prompt are collapsed automatically when opening a chat
- **Preview mode** — show the first N lines of collapsed messages instead of hiding them completely
- **Auto-collapse rules** — automatically collapse messages that exceed a length threshold or are older than N messages from the end of the chat
- **Collapse/Expand Hidden** in settings — bulk-collapse messages excluded from the prompt
- **Collapse/Expand All** in settings — collapse or expand everything at once
- **Collapse/Expand by sender** — bulk actions for user, character, or system messages
- **Master toggle** — disable the extension without uninstalling it
- **Slash commands** — `/mc-collapse`, `/mc-expand`, `/mc-toggle`

## Slash Commands

The extension registers STscript commands (requires SillyTavern's SlashCommandParser API):

- `/mc-collapse [all|disabled|user|character|system]` — collapse the target group
- `/mc-expand [all|disabled|user|character|system]` — expand the target group
- `/mc-toggle <mesid>` — toggle collapse for a specific message

Aliases: `/mcc`, `/mce`, `/mct`.

## Notes

- Manual collapse state is saved per chat and restored on reload. State is keyed by the message's `send_date` timestamp, which is stable across deletions and reordering — collapsing message #5 and then deleting an earlier message will not shift the collapse to the wrong message.
- Messages excluded from the prompt (eye icon) are auto-collapsed on chat load. This is independent of manual collapse state; use the eye icon to control prompt inclusion.
- **Collapse/Expand All** operate on every visible message but only persist manual state for non-hidden messages (hidden messages are governed by their own flag).
- **Auto-collapse rules** are computed at render time and are not persisted. If you manually expand a message that was auto-collapsed, it will stay expanded on next load (manual state overrides auto rules).

## Accessibility

- The collapse button is keyboard-operable: focus it with Tab and activate with Enter or Space.
- `aria-expanded` reflects the current state for assistive technologies.

## Internationalization

- Settings panel strings use `data-i18n` attributes and can be translated via SillyTavern's standard translation system.
