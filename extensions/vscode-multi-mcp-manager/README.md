# Multi-MCP Manager

Multi-MCP Manager provides a VS Code Activity Bar dashboard for managing the local Multi-MCP Gateway user-data folder.

## Features

- Webview dashboard with Gateway status cards, a compact toolbar, category sections, nested MCP rows, and tool summaries.
- Shared MCP settings form for install and edit, including name, category, source, command, args, key/token hints, and rescan options.
- Source install flow for npm packages, remote URLs, custom commands, or pasted JSON config, with existing category suggestions.
- MCP edit flow that can rename an MCP, move it between categories, update startup settings, and keep credential keys aligned.
- External MCP directory picker for PulseMCP, the official MCP Registry, Glama, and Smithery without maintaining an in-extension recommendation list.
- GitHub Release based extension update check: startup checks run silently, and the manual command can download and install the published VSIX after confirmation.
- Safe removal flow that shows config and credential impact before deleting an MCP.
- Keys and tokens are explained as environment variables plus local labels; secret values are collected through VS Code password input while keeping compatibility with `gateway.env` and `credentials.json`.
- English by default, with Traditional Chinese UI when VS Code runs with `zh-tw`.
- Gateway network-node icon for the extension details page and Activity Bar.

Runtime compatibility intentionally keeps the existing Gateway files in the local user-data folder.

## Updates

Multi-MCP Manager is distributed as a GitHub Release VSIX. VS Code does not auto-update extensions installed from a local VSIX, so the dashboard includes a separate extension update check. Startup checks only record status; use **Multi-MCP: Check Extension Updates** when you want to review and install a newer release.

## Safe form editing

- Reopening the sidebar requests a fresh, read-only host snapshot before restoring drafts or pending results. The original embedded HTML snapshot is not treated as current data. Opening the view never scans tools, initializes user data or resubmits a saved operation; Refresh remains available if the first state read needs a retry.
- Editing a name or category preserves the current MCP configuration, including environment values, preload, pinned package versions, custom launchers, remote headers and other config fields. Source defaults are generated only when the source or source type is explicitly changed.
- `args` uses a JSON array of strings. This preserves empty arguments, whitespace and embedded newlines exactly. Existing settings are loaded into this format automatically.
- Configuration changes and an optional credential are saved in one management operation before the requested scan. A scan failure is reported separately from an already-saved configuration; a successful rename becomes the next edit target.
- Form submissions are disabled while pending and have operation-specific acknowledgements. The pending operation ID and draft ID survive sidebar reconstruction, and the rebuilt view asks the host for the result without resending the mutation or retaining its payload. An already-committed rename is reconciled even while its scan is pending. A failed or cancelled operation keeps the draft. If the host restarted and cannot confirm an old outcome, the dashboard reloads current settings and requires a fresh edit instead of guessing or retrying.
- Names, categories and other non-secret form metadata survive sidebar reconstruction. Source URLs, full JSON, command, args and environment values are never written to persistent webview state, because any of them may contain literal secrets. If those fields had unsaved changes, reopening requires re-entry or explicit review of the current settings. Cancel clears the draft.
- Credential management currently supports **one environment-variable name per MCP**, with multiple account labels for that variable. An existing variable name cannot be changed in place. Saving a new label does not automatically switch the active account; use **切換使用的帳號**. Deleting credentials in the dashboard removes all labels for that MCP. Multi-variable credentials must be managed through the complete MCP JSON or external environment, outside this single-variable credential UI.
- The extension edits local configuration and registry files. An already-running Gateway must reconnect or use its own rescan/reload to apply changes; the extension does not claim an IPC connection to it. The overview distinguishes the bundled Gateway core version, extension version and unknown running-Gateway version.

## Local regression tests

With Node.js 24, run `npm run test:unit --prefix extensions/vscode-multi-mcp-manager` from the repository root. These dependency-free tests execute the real form model, generated webview script in a VM with DOM adapters, and extension-host message handlers with controlled VS Code/management adapters. They cover all seven default seeds, lossless configuration edits, transaction handoff, account switching, submission correlation, non-secret persistence, stale-HTML reconstruction and read-only startup/retry. They are not a substitute for the existing Electron/VS Code GUI smoke test or a packaged VSIX test.

The bundle script reads the root `package.json` and embeds that core version at build time. It does not derive the core version from the extension manifest.
