# Azure Resource Group Cleaner

A fast, smart tool for batch deletion of Azure resource groups with demo protection and safety features.

## Purpose

**Clean up subscription clutter while keeping your demos safe.**

Demo RGs (containing keywords like "demo", "ignite", "build", "conference") are automatically **protected** — they're flagged so you don't accidentally delete them. The tool helps you identify and remove old projects, expired POCs, and forgotten test resources while preserving your important demo environments.

## Three Ways to Use

| Mode | Best For | How |
|------|----------|-----|
| **CLI Tool** | Quick interactive cleanup | `./rg-cleaner.sh` |
| **MCP Server** | AI agents (Claude, Copilot, etc.) | Connect via `.github/mcp/mcp.json` |
| **Local Agent** | Natural language commands | Load `CLAUDE.md` + MCP tools |

## Features

- 🛡️ **Demo Protection** - Auto-detects and protects demo/event resource groups
- ⏱️ **Time-based Filtering** - Filter by last week, month, 3 months, or all
- 🖱️ **Interactive Selection** - Visual multi-select with keyboard navigation
- ⚡ **Parallel Deletion** - Deletes multiple RGs simultaneously
- 🔍 **Audit Mode** - Dry-run to preview what would be deleted
- ✅ **Safety Prompts** - Confirmation before destructive actions
- 📊 **Resource Counts** - Shows how many resources in each RG

## Quick Start

```bash
# Make executable
chmod +x rg-cleaner.sh

# Run with defaults (last week's RGs)
./rg-cleaner.sh

# Audit mode (dry run)
./rg-cleaner.sh --audit

# Last month's RGs
./rg-cleaner.sh -t month

# Last 3 months, skip final prompt
./rg-cleaner.sh -t 3months -y
```

## Installation

```bash
# Clone or download
git clone <repo-url>
cd rg-cleaner

# Make executable
chmod +x rg-cleaner.sh

# Optional: Add to PATH
ln -s $(pwd)/rg-cleaner.sh /usr/local/bin/rg-cleaner
```

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Logged in to Azure (`az login`)
- Permissions to delete resource groups

## Usage

```
Azure Resource Group Cleaner

USAGE:
    rg-cleaner [OPTIONS]

OPTIONS:
    -t, --time <period>     Filter RGs by creation time (default: week)
                            Options: week, month, 3months, all
    -a, --audit             Audit mode - simulate deletion without actually deleting
    -y, --yes               Skip final confirmation prompt
    -s, --subscription <id> Use specific subscription (default: current default)
    -h, --help              Show this help message
```

## Interactive Controls

| Key | Action |
|-----|--------|
| ↑ / k | Move up |
| ↓ / j | Move down |
| Space | Toggle selection |
| a | Select all |
| n | Select none |
| Enter | Confirm |
| q | Quit |

## Demo Detection (Protected RGs)

Resource groups are flagged as `[DEMO]` and **protected from deletion** if their name contains:

**Keywords:** demo, test, tmp, temp, scratch, playground, sandbox, poc, prototype

**Events:** build, ignite, inspire, ready, summit, conference, hackathon, workshop

**Locations:** seattle, redmond, vegas, orlando, chicago, london, paris, tokyo, sydney, singapore, amsterdam, austin, boston, nyc, sf, la, berlin

These RGs are highlighted in the CLI and protected in MCP tools — review them separately if you want to delete them.

## Examples

### Clean up after an event
```bash
./rg-cleaner.sh -t week
```

### Preview deletions without making changes
```bash
./rg-cleaner.sh -t month --audit
```

### Delete from specific subscription
```bash
./rg-cleaner.sh -s "Visual Studio Enterprise"
```

### Fully automated (dangerous!)
```bash
./rg-cleaner.sh -t week -y
```

## Exclude List

The `exclude-list.txt` file controls which resource groups are automatically hidden from the selection. Edit this file to customize exclusions for your environment.

### File Format

```
# Comments start with #
^DefaultResourceGroup    # Regex: starts with
^my-rg$                  # Regex: exact match
-temp$                   # Regex: ends with
_managed$                # Azure managed RGs
```

### Managing with Copilot CLI

Ask the agent to update your exclude list:

```
"Add rg-production to my exclude list"
"Exclude all RGs starting with 'test-'"
"Remove rg-old from exclude list"
"Show my current exclusions"
```

### Default Exclusions

The tool ships with sensible defaults:
- `DefaultResourceGroup*` - Azure default RGs
- `NetworkWatcherRG` - Network monitoring
- `cloud-shell-storage*` - Cloud Shell storage
- `MC_*` - AKS managed clusters
- `*_managed` - Service-managed RGs

### Adding Custom Exclusions

```bash
# Add a specific RG
echo "^my-permanent-rg$" >> exclude-list.txt

# Add a pattern (all RGs starting with "prod-")
echo "^prod-" >> exclude-list.txt

# View current exclusions
cat exclude-list.txt
```

## Safety Notes

⚠️ **Deletion is permanent** - Resource groups and all contained resources will be destroyed

✅ Always use `--audit` first to preview what will be deleted

✅ The tool requires explicit confirmation (unless `-y` is used)

✅ Demo-flagged RGs are just suggestions - review before deleting

## MCP Server (for AI Agents)

Connect your favorite AI agent to the rg-cleaner MCP server for natural language resource group management.

### Supported Agents

Works with any MCP-compatible agent:
- **GitHub Copilot** (VS Code, CLI)
- **Claude Desktop**
- **Custom agents**

### Setup

1. **Install and build:**
   ```bash
   cd mcp-function
   npm install
   npm run build
   ```

2. **Start Azurite (storage emulator):**
   ```bash
   azurite --silent --location /tmp/azurite
   ```

3. **Start the function (in another terminal):**
   ```bash
   func start
   # MCP endpoint: http://localhost:7071/runtime/webhooks/mcp
   ```

3. **Connect your agent** using `.github/mcp/mcp.json`

### Deploy to Azure

```bash
cd mcp-function
azd up
# Update .github/mcp/mcp.json URL with your deployed function endpoint
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_resource_groups` | List RGs with demo/exclusion flags |
| `delete_resource_groups` | Delete with audit mode support |
| `get_exclude_patterns` | View protected patterns |
| `detect_demo_rgs` | Find demo RGs (these are PROTECTED) |

### Example Agent Conversations

**Clean up subscription:**
> **You:** "Clean up my subscription"
> 
> **Agent:** Found 32 deletable RGs (8 demos protected). Delete rg-old-project, rg-expired-poc...?
> 
> **You:** "Yes, delete them all"
> 
> **Agent:** Deleted 32 resource groups. 8 demo RGs preserved.

**See what's protected:**
> **You:** "Show my demos"
> 
> **Agent:** You have 8 demo RGs (protected): rg-ignite-demo, rg-build-2024, rg-seattle-workshop...

**Region cleanup:**
> **You:** "Clean up eastus region"
> 
> **Agent:** Found 12 deletable RGs in eastus (3 demos protected). Proceed?

See [CLAUDE.md](./CLAUDE.md) and [AGENTS.md](./AGENTS.md) for agent-specific instructions.

## License

MIT
