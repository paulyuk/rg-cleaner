# RG Cleaner - Agent Instructions

This document provides instructions for AI agents using the rg-cleaner MCP tools.

## Purpose

**Main Use Case:** Clean up non-demo resource groups while protecting demo/event RGs.

Demo RGs (containing keywords like "demo", "ignite", "build") are **kept safe** — they're filtered out so you don't accidentally delete conference demos. The tool helps you identify and remove the clutter (old projects, expired POCs, forgotten test resources) while preserving your important demo environments.

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
| `detect_demo_rgs` | Find demo RGs (these are PROTECTED, not deleted) |

## Common Tasks

### "Show my resource groups"
```
→ Call: list_resource_groups({includeExcluded: true})
→ Display as table: Name | Location | Demo? | Deletable?
```

### "What can I clean up?" / "Find cleanup candidates"
```
→ Call: list_resource_groups({includeExcluded: false})
→ Filter to show only non-demo, non-excluded RGs
→ These are safe to delete (demos are already filtered out)
```

### "Clean up my subscription" / "Delete old RGs"
```
1. Call: list_resource_groups({includeExcluded: false})
2. Filter out demo RGs (isDemo: true) — these stay protected
3. Show remaining RGs as cleanup candidates
4. Ask user to confirm which ones to delete
5. Call: delete_resource_groups({names: "rg1,rg2", audit: true})
6. Show dry-run results
7. On confirmation: delete_resource_groups({names: "rg1,rg2", audit: false})
```

### "Delete specific RGs"
```
1. Call: delete_resource_groups({names: "rg-foo,rg-bar", audit: true})
2. Show what would be deleted
3. On user confirmation: delete_resource_groups({names: "rg-foo,rg-bar", audit: false})
```

### "Show my demos" / "What demos do I have?"
```
→ Call: detect_demo_rgs()
→ Show demo RGs — these are PROTECTED from deletion
```

### "What's protected?" / "Why wasn't X deleted?"
```
→ Call: get_exclude_patterns()
→ Show built-in and custom patterns
```

### "How many RGs do I have?" / "Subscription overview"
```
→ Call: list_resource_groups({includeExcluded: true})
→ Summarize: Total X RGs, Y demos (protected), Z excluded, W deletable
```

### "Delete everything except demos"
```
1. Call: list_resource_groups({includeExcluded: false})
2. Get all RGs where isDemo: false
3. Show list, confirm with user
4. delete_resource_groups({names: "...", audit: true}) → dry-run
5. delete_resource_groups({names: "...", audit: false}) → execute
```

### "What's safe to delete in eastus?"
```
→ Call: list_resource_groups({includeExcluded: false})
→ Filter by location === "eastus" AND isDemo === false
→ Show as cleanup candidates
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
