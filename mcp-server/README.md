# RG Cleaner MCP Server

MCP (Model Context Protocol) server exposing Azure Resource Group Cleaner tools for AI agents.

## Two Server Modes

| Mode | Use Case | Command |
|------|----------|---------|
| **Stdio** | Local development, Claude Desktop | `node index.js` |
| **HTTP** | Azure Functions, remote agents | `func start` |

## Quick Start

```bash
npm install
```

### Stdio Mode (for Claude Desktop, Copilot CLI)

```bash
node index.js
```

Configure in your agent:
```json
{
  "command": "node",
  "args": ["/path/to/rg-cleaner/mcp-server/index.js"]
}
```

### HTTP Mode (Azure Function)

```bash
func start
# Server at http://localhost:7071/api/mcp
```

Call tools via POST:
```bash
# List tools
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'

# Call a tool
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "detect_demo_rgs", "arguments": {}}}'
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_resource_groups` | List all RGs with demo detection and exclusion status |
| `delete_resource_groups` | Delete RGs with audit mode support |
| `get_exclude_patterns` | Show current exclusion patterns |
| `detect_demo_rgs` | Find temporary/demo RGs |

## Agent Integration

See the root-level docs for agent-specific instructions:
- [AGENTS.md](../AGENTS.md) - General agent instructions
- [CLAUDE.md](../CLAUDE.md) - Claude-specific guidance
- [.github/mcp/mcp.json](../.github/mcp/mcp.json) - MCP configuration

## Prerequisites

- Node.js 18+
- Azure CLI installed and authenticated (`az login`)
- Azure Functions Core Tools (for HTTP mode): `npm i -g azure-functions-core-tools@4`
