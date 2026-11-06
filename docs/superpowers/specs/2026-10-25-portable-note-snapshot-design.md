# Portable note snapshots

## Goal

Keep a readable copy of handwritten notes available in Obsidian when the Handwriting plugin is disabled or removed.

## Storage contract

- Editable strokes remain in the existing `.handwriting` sidecar JSON files.
- Inked Markdown notes receive a comment-free managed HTML block identified by `data-handwriting-portable-snapshot="true"`.
- The block contains a relative image link to an SVG in `Handwriting snapshots/<page-id>/`.
- Each published snapshot gets a new immutable filename. Failed publication leaves the previous link intact.
- Superseded snapshots remain recoverable for 30 days, then are removed automatically when they are no longer referenced.
- When the last stroke is erased, the managed block is removed and a per-page deletion marker starts a 30-day retention period for its snapshots.
- When a note is deleted, its confirmed orphaned snapshots are removed automatically; startup reconciliation handles notes deleted before this lifecycle was installed.
- Snapshot files with uncertain ownership or current Markdown references are preserved.

Legacy `1.5.0` blocks wrapped in `handwriting-portable-snapshot:start/end` HTML comments are recognized and migrated during the next snapshot refresh.

## Rendering

The snapshot renderer uses Obsidian’s Markdown renderer for the complete note body and serializes the rendered layout into an SVG `foreignObject`. Handwriting is added as vector paths from the original stroke geometry. Local Markdown images are embedded as data URLs when they can be resolved through the vault.

The source body excludes the managed snapshot block, preventing recursive snapshots. Width is taken from the open Markdown view when available; otherwise a readable default width is used. Snapshot work is debounced, serialized per note, retried on the next change after a stale stroke revision, and flushed during plugin shutdown. Startup and periodic reconciliation compare live `handwriting-page-id` ownership and Markdown references before cleaning expired or orphaned files.

## Compatibility

The Markdown note remains the owner of the snapshot link. Obsidian’s normal Markdown image renderer can display it without the plugin. Re-enabling the plugin continues to load and edit the original sidecar strokes.

SVG `foreignObject` rendering and complex external resources require device verification in Obsidian Mobile. A failed or unsupported export reports an error and preserves the previous managed link.
