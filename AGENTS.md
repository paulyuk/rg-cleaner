# RG Cleaner - Agent Instructions

This document provides instructions for AI agents using the rg-cleaner MCP tools.

## MCP Server Connection

**Endpoint:** `http://localhost:7071/runtime/webhooks/mcp`

**Config:** `.github/mcp/mcp.json`

Before using tools, ensure the MCP server is running:
```bash
# Terminal 1: Azurite
azurite --silent --location /tmp/azurite

# Terminal 2: Function
cd mcp-function && func start
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_resource_groups` | List all RGs with demo/exclusion metadata |
| `delete_resource_groups` | Delete RGs (supports audit mode) |
| `get_exclude_patterns` | Show protected patterns |
| `detect_demo_rgs` | Find temporary/demo RGs |

## Common Tasks

### "Show my resource groups"
```
→ Call: list_resource_groups({includeExcluded: true})
→ Display as table: Name | Location | Demo? | Excluded?
```

### "Find cleanup candidates" / "What can I delete?"
```
→ Call: detect_demo_rgs()
→ Show demo RGs with matched patterns
→ Recommend deletion with audit first
```

### "Clean up demo RGs" / "Delete test resources"
```
1. Call: detect_demo_rgs() → get names
2. Show list, ask user to confirm
3. Call: delete_resource_groups({names: "rg1,rg2,rg3", audit: true})
4. Show dry-run results
5. On confirmation: delete_resource_groups({names: "rg1,rg2,rg3", audit: false})
```

### "Delete specific RGs"
```
1. Call: delete_resource_groups({names: "rg-foo,rg-bar", audit: true})
2. Show what would be deleted
3. On user confirmation: delete_resource_groups({names: "rg-foo,rg-bar", audit: false})
```

### "What's protected?" / "Why wasn't X deleted?"
```
→ Call: get_exclude_patterns()
→ Show built-in and custom patterns
```

## Tool Reference

### `list_resource_groups`

**Parameters:**
- `includeExcluded` (boolean, default: true): Include excluded RGs in output

**Response:**
```json
{
  "total": 52,
  "excluded": 18,
  "demos": 12,
  "groups": [
    {"name": "rg-demo", "location": "eastus", "isDemo": true, "isExcluded": false},
    {"name": "NetworkWatcherRG", "location": "westus", "isDemo": false, "isExcluded": true}
  ]
}
```

### `delete_resource_groups`

**Parameters:**
- `names` (string, required): Comma-separated RG names (e.g., "rg-demo1,rg-test2")
- `audit` (boolean, default: false): Dry-run mode

**Response:**
```json
{
  "mode": "audit",
  "results": [
    {"name": "rg-demo1", "status": "audit", "message": "Would delete: rg-demo1"},
    {"name": "rg-protected", "status": "skipped", "reason": "excluded by pattern"}
  ]
}
```

### `detect_demo_rgs`

**Response:**
```json
{
  "totalGroups": 52,
  "demoCount": 12,
  "demoGroups": [
    {"name": "rg-ignite-demo", "location": "eastus", "matchedPatterns": ["demo", "ignite"]}
  ]
}
```

### `get_exclude_patterns`

**Response:**
```json
{
  "builtIn": ["^DefaultResourceGroup", "^NetworkWatcherRG$", "^MC_"],
  "fromFile": ["^pyacrgroup$", "^rg-production"]
}
```

## Demo Detection Patterns

Keywords: `demo`, `test`, `temp`, `tmp`, `scratch`, `playground`, `sandbox`, `trial`, `poc`, `prototype`, `experiment`

Events: `ignite`, `build`, `msbuild`, `reinvent`, `summit`, `conference`, `workshop`, `hackathon`

Cities: `orlando`, `seattle`, `vegas`, `austin`, `chicago`, `boston`, `london`, `paris`, `tokyo`, `sydney`

## Safety Rules

1. **Always audit first** - Use `audit: true` before real deletion
2. **Confirm with user** - Never delete without explicit confirmation
3. **Respect exclusions** - Excluded RGs are skipped automatically
4. **Warn about permanence** - Deletion cannot be undone
5. **Handle failures** - Some RGs may fail due to locks or dependencies
