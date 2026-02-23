# Azure Resource Group Cleaner

A fast, interactive CLI tool for batch deletion of Azure resource groups with smart demo detection and safety features.

## Features

- 🎯 **Smart Demo Detection** - Auto-detects demo/test/event resource groups
- ⏱️ **Time-based Filtering** - Filter by last week, month, 3 months, or all
- 🖱️ **Interactive Selection** - Visual multi-select with keyboard navigation
- ⚡ **Parallel Deletion** - Deletes multiple RGs simultaneously
- 🔍 **Audit Mode** - Dry-run to preview what would be deleted
- 🛡️ **Safety Prompts** - Confirmation before destructive actions
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

## Demo Detection

Resource groups are flagged as `[DEMO]` if their name contains:

**Keywords:** demo, test, tmp, temp, scratch, playground, sandbox, poc, prototype

**Events:** build, ignite, inspire, ready, summit, conference, hackathon, workshop

**Locations:** seattle, redmond, vegas, orlando, chicago, london, paris, tokyo, sydney, singapore, amsterdam, austin, boston, nyc, sf, la, berlin

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

## License

MIT
