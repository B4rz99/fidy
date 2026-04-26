# MemPalace - Codex Plugin

Give your AI a persistent memory by mining projects and conversations into a searchable palace backed by ChromaDB.

## Prerequisites

- Python 3.9+
- Codex installed and configured
- `pip install mempalace`

## Installation

This repository exposes MemPalace through the repo-local marketplace at `.agents/plugins/marketplace.json`. In Codex, open `/plugins`, find MemPalace in the Fidy marketplace, and install or enable it.

After installation, initialize your palace:

```bash
codex /init
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `/help` | Show available commands and usage tips |
| `/init` | Initialize a new memory palace |
| `/search` | Semantic search across all mined memories |
| `/mine` | Mine a project or conversation into your palace |
| `/status` | Show palace status, room counts, and health |

## MCP

The plugin registers the MemPalace MCP server through `.mcp.json`.

## Support

- Repository: https://github.com/MemPalace/mempalace
- Issues: https://github.com/MemPalace/mempalace/issues
