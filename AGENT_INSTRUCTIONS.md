# Agent Instructions for rg-cleaner

## Overview
`rg-cleaner` is a bash CLI tool for batch deletion of Azure resource groups with smart demo detection and safety features.

## When to Use This Tool

Invoke `rg-cleaner` when the user wants to:
- Clean up Azure resource groups in bulk
- Delete demo/test/event resource groups
- Audit what resource groups would be deleted
- Remove resource groups created within a time period

## Usage Patterns

### Basic Cleanup (Last Week's RGs)
```bash
./rg-cleaner.sh
```

### Extended Time Periods
```bash
./rg-cleaner.sh -t month      # Last month
./rg-cleaner.sh -t 3months    # Last 3 months  
./rg-cleaner.sh -t all        # All resource groups
```

### Audit Mode (Dry Run)
```bash
./rg-cleaner.sh --audit
./rg-cleaner.sh -t month --audit
```

### Non-Interactive (Skip Final Confirmation)
```bash
./rg-cleaner.sh -y
./rg-cleaner.sh -t month -y
```

### Specific Subscription
```bash
./rg-cleaner.sh -s "subscription-id-or-name"
```

## Interactive Controls

When the selection UI appears:
| Key | Action |
|-----|--------|
| ↑ / k | Move selection up |
| ↓ / j | Move selection down |
| SPACE | Toggle selection on/off |
| a | Select all |
| n | Deselect all |
| ENTER | Confirm selection |
| q | Quit/cancel |

## Demo Detection

The tool auto-detects likely demo/test resource groups by scanning names for:
- **Demo keywords**: demo, test, tmp, temp, scratch, playground, sandbox, poc, prototype
- **Event names**: build, ignite, inspire, ready, envision, summit, conference, hackathon
- **Location names**: seattle, redmond, vegas, orlando, chicago, london, paris, tokyo, etc.
- **Training**: workshop, lab, hands-on, training

Detected demos are highlighted in **yellow [DEMO]** in the UI.

## Safety Features

1. **Interactive Selection**: All RGs shown for review before deletion
2. **Demo Detection**: Highlights likely safe-to-delete RGs
3. **Final Confirmation**: Requires explicit y/N before deletion
4. **Audit Mode**: Simulates deletion without making changes
5. **Resource Count**: Shows number of resources per RG
6. **Async Deletion**: Uses `--no-wait` for parallel processing

## Prerequisites

- Azure CLI (`az`) installed
- Logged in (`az login`)
- Appropriate permissions to delete resource groups

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not logged in, invalid args, etc.) |

## Example Session

```
$ ./rg-cleaner.sh -t month --audit

Azure Resource Group Cleaner
Subscription: My-Subscription  abc123
Time filter: month
Mode: AUDIT (dry-run)

ℹ Fetching resource groups created after 2026-01-23...

Select Resource Groups to Delete
Use ↑/↓ to navigate, SPACE to toggle, a to select all, n to select none, ENTER to confirm

 → [✓] demo-ignite-2026 (westus2, 12 resources) [DEMO]
   [✓] rg-production-api (eastus, 45 resources)
   [✓] seattle-workshop-jan (westus2, 8 resources) [DEMO]
   [ ] rg-critical-db (eastus, 3 resources)

Selected: 3 of 4

[AUDIT] Would delete: demo-ignite-2026
[AUDIT] Would delete: rg-production-api
[AUDIT] Would delete: seattle-workshop-jan
[AUDIT] Audit complete. 3 resource groups would be deleted.
```

## Updating the Exclude List

The `exclude-list.txt` file controls which resource groups are automatically excluded from the selection list. Users can ask you to update this file.

### Common Requests

**"Add [rg-name] to the exclude list"**
```bash
echo "^rg-name$" >> exclude-list.txt
```

**"Exclude all RGs starting with 'prod-'"**
```bash
echo "^prod-" >> exclude-list.txt
```

**"Exclude RGs ending with '-permanent'"**
```bash
echo "-permanent$" >> exclude-list.txt
```

**"Show me the current exclude list"**
```bash
cat exclude-list.txt
```

**"Remove [pattern] from exclude list"**
Edit the file and remove the matching line.

### Pattern Syntax

The exclude list uses case-insensitive regex patterns:
| Pattern | Matches |
|---------|---------|
| `^rg-prod$` | Exactly "rg-prod" |
| `^rg-prod` | Starts with "rg-prod" |
| `-prod$` | Ends with "-prod" |
| `prod` | Contains "prod" anywhere |
| `^MC_` | Azure AKS managed clusters |
| `_managed$` | Azure managed resource groups |

### Example exclude-list.txt
```
# System RGs
^DefaultResourceGroup
^NetworkWatcherRG$

# Personal permanent RGs
^my-important-rg$
^prod-

# Managed RGs
_managed$
^MC_
```

## Common Scenarios

### "I need to clean up after an event"
```bash
./rg-cleaner.sh -t week   # Event was recent
```

### "Show me what would be deleted without actually deleting"
```bash
./rg-cleaner.sh --audit
```

### "Delete all my demo RGs from the last quarter"
```bash
./rg-cleaner.sh -t 3months
```

### "I'm sure about the deletion, don't ask me twice"
```bash
./rg-cleaner.sh -y
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not logged into Azure" | Run `az login` |
| "No resource groups found" | Check subscription with `az account show` |
| Arrow keys not working | Use j/k for navigation instead |
| Deletion fails | Check RBAC permissions on subscription |
