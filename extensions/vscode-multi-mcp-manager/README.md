# Multi-MCP Manager

Multi-MCP Manager provides a VS Code Activity Bar dashboard for managing the local Multi-MCP Gateway user-data folder.

## Features

- Webview dashboard with Gateway status cards, a compact toolbar, category sections, nested MCP rows, and tool summaries.
- Source install flow for npm packages, remote URLs, or pasted JSON config, with existing category pickers.
- `mcpServers` JSON import flow for MCP client snippets.
- External MCP directory picker for PulseMCP, the official MCP Registry, Glama, and Smithery without maintaining an in-extension recommendation list.
- Safe removal flow that shows config and credential impact before deleting an MCP.
- Credentials are masked in the UI while keeping compatibility with `gateway.env` and `credentials.json`.
- English by default, with Traditional Chinese UI when VS Code runs with `zh-tw`.
- Gateway network-node icon for the extension details page and Activity Bar.

Runtime compatibility intentionally keeps the existing Gateway files in the local user-data folder.
