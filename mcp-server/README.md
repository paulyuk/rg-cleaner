# RG Cleaner MCP Server

An MCP (Model Context Protocol) server that exposes the Azure Resource Group Cleaner as tools for AI agents.

## Installation

```bash
cd mcp-server
npm install
```

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rg-cleaner": {
      "command": "node",
      "args": ["/absolute/path/to/rg-cleaner/mcp-server/index.js"]
    }
  }
}
```

Then restart Claude Desktop.

## Usage with Other MCP Clients

Run the server directly:
```bash
node index.js
```

The server uses stdio transport and speaks MCP protocol.

## Available Tools

| Tool | Description |
|------|-------------|
| `list_resource_groups` | List all RGs with demo detection and exclusion status |
| `delete_resource_groups` | Delete RGs with audit mode support |
| `get_exclude_patterns` | Show current exclusion patterns |
| `detect_demo_rgs` | Find temporary/demo RGs |

## Example Agent Interaction

**User:** "Clean up my demo resource groups"

**Agent workflow:**
1. `detect_demo_rgs` → finds demo RGs
2. Shows list to user for confirmation
3. `delete_resource_groups({names: [...], audit: true})` → dry run
4. User confirms
5. `delete_resource_groups({names: [...], audit: false})` → actual deletion

## Prerequisites

- Node.js 18+
- Azure CLI installed and authenticated (`az login`)
- Active Azure subscription

## Agent Instructions

See [agents.md](./agents.md) for detailed guidance on using these tools effectively.
