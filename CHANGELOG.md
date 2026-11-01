# Changelog

This history reconstructs the changes made after the installed `1.4.23` bundle. The release periods are based on the preserved baseline, implementation plans/specifications, checkpoints, and verification records. The intermediate versions are historical groupings; the current distributable bundle is `1.8.8`.

## 1.8.8 — 2026-11-01

### Added

- Added a global Handwriting / Typing mode control for Markdown notes. Handwriting is selected on plugin startup; Typing restores text editing while handwriting tools are disabled, and existing text and ink remain preserved.

### Fixed

- Handwriting mode now makes note editors non-editable and prevents finger taps from focusing the note or opening the keyboard. Typing mode hides the expanded toolbar, collapsed pen pill, popovers, tips, and note zoom controls.
- Handwriting mode now applies `inputmode="none"` before touch focus can begin, eliminating the occasional transient keyboard flash while preserving the original input mode in Typing mode and during pane teardown.

## 1.8.7 — 2026-11-01

### Fixed

- Active SVG handwriting now hides the wet canvas and pen tile together and restores their captured visibility only after raster cleanup, removing the visible Pencil-down/Pencil-up presentation transition.
- The active SVG patcher is idempotent across generated bundle revisions, with regression coverage for ownership cleanup and tile-canvas integration.

## 1.8.6 — 2026-10-30

### Changed

- Removed the Classic handwriting selector from settings and new-stroke selection.
- Preserved existing Classic handwriting unchanged, including legacy parsing and rendering fallback compatibility; no vault-wide conversion or startup migration is performed.
- Fountain pressure profiles remain the supported choice for new strokes.

## 1.8.5 — 2026-10-30

### Fixed

- Active Apple Pencil fountain strokes now use the existing clipped SVG presentation while the Pencil is down, removing the contact-time raster softness before the sharp settled handoff.
- Live SVG updates are batched once per animation frame and append only new ribbon chunks, preserving responsive input while bridging chunk endpoints so visible gaps do not return.
- Added deterministic active-stroke replay and bundle-integration checks, with cleanup and Canvas fallback for renderer changes, cancellation, resize fallback, and note teardown.

## 1.8.2 — 2026-10-29

### Fixed

- Completed SVG handwriting keeps a bounded geometry cache and avoids unnecessary DOM writes during camera movement, improving responsiveness on larger notes.
- SVG presentation updates retain the canonical viewport while refreshing only changed geometry and host measurements, preventing stale or magnified handwriting during panning and pinch zoom.
- Canvas mode no longer applies elastic edge overscroll; reaching a canvas boundary clamps immediately while explicit pinch settlement corrections remain available.
- Startup and note reopen paths wait for a valid SVG viewport and reconcile stored handwriting before presenting completed ink.

## 1.8.1 — 2026-10-29

### Fixed

- Existing SVG handwriting is now reconciled after the note camera has been synchronized, preventing stale viewport culling from hiding strokes when a note is reopened.
- Loading stored handwriting and switching completed-ink renderers now invalidate the SVG presentation cache before repainting, so sidecar-loaded strokes cannot be mistaken for an already-rendered empty state.
- SVG presentation now waits for a valid initial viewport during app startup, preventing an early layout race from silently falling back to blurry Canvas rendering while SVG remains selected.
- SVG presentation now derives its viewBox from the renderer's canonical camera viewport, preventing repeated pan updates from magnifying or shifting handwriting.
- Presentation geometry is refreshed once per animation frame, so pane and sidebar movement cannot reuse stale screen coordinates.

## 1.8.0 — 2026-10-28

### Changed

- Completing an eraser gesture with Pencil now restores the previously selected pen or highlighter mode. The restore also occurs for an empty erase, while explicitly choosing another tool or cancelling the eraser clears the pending restore.

## 1.7.2 — 2026-10-28

### Fixed

- Completed SVG ink now lives in one permanent host inside the owning Markdown note, outside the scaled editor. The host is clipped to the note viewport and stays below note tools, sidebars, and other app UI.
- SVG layers are created in that host once and are no longer reparented during repaint, scroll, pinch zoom, or Pencil interaction, preventing stale alignment and overlap during transitions.
- Unsupported note-root transforms and invalid SVG mappings fall back to the existing Canvas presentation instead of mounting ink on `document.body`.
- Removed the obsolete **Settled SVG presentation** experiment setting; completed SVG presentation is now automatic when **Completed handwriting → SVG (sharp)** is selected.
- Zoom-report ancestor inspection stops at element nodes, so **Diagnostics: show zoom report** remains available with the permanent layer.
- Pencil-lift publication now upserts only the newly completed stroke, reuses unchanged path nodes and geometry, and keeps a valid SVG host visible during ordinary repainting. The zoom report includes the latest SVG handoff time and incremental-render counters.

## 1.7.0 — 2026-10-28

### Fixed

- Completed handwriting in Markdown note editors now uses inline SVG by default, removing the canvas resampling softness seen on iPad at 100–150% zoom.
- Live Apple Pencil input remains on the low-latency canvas and hands off synchronously to the SVG layer when the stroke is lifted.

### Added

- A **Completed handwriting** setting with **SVG (sharp)** and **Canvas (compatibility)** choices.
- A developer **Settled SVG presentation** experiment. **External** places idle completed SVG ink outside the scaled editor but inside the owning note's local stacking context; **Editor** remains the default until iPad interaction validation is complete.
- Keyed SVG path reconciliation with camera-aware view boxes, separate pen/highlighter layers, geometry reuse, and Canvas fallback on renderer failure.
- SVG renderer diagnostics in the existing zoom report.

### Compatibility

- Stroke storage, fountain/classic metadata, erasing, selection, undo/redo, portable snapshots, and export geometry remain based on the existing stroke model.
- PDF and slide editors continue using their existing renderers.
- Automated checks cover the SVG layer contract and bundle integration. iPad note-editor validation for erasing, selection, and long-note performance remains required before treating the release as fully accepted.

## 1.6.0 — 2026-10-26

### Added

- Refined fountain-pen rendering for new Apple Pencil pen strokes.
- Elapsed-time pressure filtering, restrained speed thinning, continuous width changes, rounded caps, and controlled release tapering.
- Per-stroke `inkStyle: "fountain-v1"` metadata so saved handwriting keeps its rendering after settings changes, reloads, and exports.
- A **Classic / Fountain pen** setting. Fountain pen is the default for new stylus strokes; existing strokes retain their stored renderer.

### Changed

- Live wet ink, settled canvas ink, portable SVG snapshots, and PDF vector output share the fountain stroke geometry.
- Added deterministic fountain geometry, storage, and bundle integration checks.

### Compatibility

- Legacy strokes and unknown future style identifiers use the existing renderer and remain preserved by sidecar storage.
- Classic can be selected for subsequent strokes if the refined style is not preferred.

## 1.5.3 — 2026-10-26

### Fixed

- Scoped the resize comparison variable so canvas resize and redraw continue under strict mode.

### Diagnostics

- Added an opt-in rendering comparison for synthetic and last-stroke replays at 100%, 125%, and 150%.
- Added current-raster, native-resolution-canvas, and same-geometry SVG views with copyable measurements.
- Extended the zoom report with canvas-to-display ratios, fractional physical placement, ink-layer bounds, and ancestor-transform evidence.

The comparison build is diagnostic. It preserves the existing pressure, width, stroke, and storage behaviour while the remaining baseline softness is measured on the affected iPad.

## 1.5.2 — 2026-10-26

### Fixed

- Prevented 150% pinch-zoom handwriting from falling back to a lower-resolution backing raster when the default overscan band exceeded the canvas pixel budget.
- Adapted the raster overscan band to the requested Retina-plus-zoom scale while preserving the existing memory ceiling and visible-region redraw behavior.

### Performance

- Replaced iterative overscan fitting with a closed-form calculation so pinch and scroll band updates avoid unnecessary per-frame search work.
- Added raster target/allocation diagnostics to the existing zoom report for confirming when the memory ceiling is limiting resolution.

## 1.5.1 — 2026-10-25

### Fixed

- Removed visible portable-snapshot HTML comment markers from notes while Handwriting is active.
- Replaced comment-delimited snapshot blocks with a self-identifying, comment-free HTML block.
- Automatically migrates both spaced and compact `1.5.0` snapshot markers when an affected note is refreshed.

### Compatibility

- Existing SVG snapshot attachments and editable `.handwriting` sidecars are preserved.
- Snapshots remain readable when the plugin is disabled or removed.

## 1.5.0 — 2026-10-25

### Added

- Portable note snapshots for inked Markdown notes.
- Managed snapshot blocks that link to SVG attachments under `Handwriting snapshots/<page-id>/`.
- Full-page snapshot rendering that combines the rendered note body with vector handwriting.
- Debounced refresh after handwriting or text changes, serialized per note and flushed during plugin shutdown.
- Refresh and rebuild commands for portable snapshots.

### Compatibility

- Snapshots remain visible in Obsidian when the Handwriting plugin is disabled or removed.
- Editable strokes remain in the existing `.handwriting` sidecar files and can be edited again when the plugin is re-enabled.
- Removing the last stroke removes the managed link while retaining previous SVG attachments for recovery.

## 1.4.25 — Follow-up period after 1.4.24 and before 1.5.0

### Fixed

- Reduced handwriting blur after pinch zoom by redrawing settled ink from stored stroke geometry at the final display resolution.
- Prevented low-resolution preview layers from becoming the final settled frame.
- Disabled image interpolation during pinch compositing to avoid a second smoothing pass.

### Performance

- Kept the high-resolution mobile backing target while preserving the actual visual pinch scale.
- Preserved coalesced settle/repaint work, generation guards, cache reuse, and canvas memory limits to minimize lag.

The workspace does not contain a separate timestamp for this follow-up, so it is intentionally recorded as a bounded implementation period rather than assigned an unsupported calendar date.

## 1.4.24 — 2026-10-21

### Added

- Pinch-only note zoom for Apple Pencil workflows.
- Hard 150% maximum zoom, including live preview and restored state.
- Floating percentage readout/reset control inside the note pane.

### Changed

- Removed the four-button zoom control in favor of the floating readout.
- Scoped note zoom transforms and clipping to the note pane so the Obsidian sidebar remains stable.
- Preserved existing stroke data, pressure, colors, undo/redo behavior, and note contents.

## 1.4.23 — Baseline

The installed bundle before the October 2026 zoom and portable-retention work.
