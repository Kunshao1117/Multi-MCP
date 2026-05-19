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
