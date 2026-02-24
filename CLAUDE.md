# Claude Instructions for RG Cleaner

You have access to the **rg-cleaner** MCP server for managing Azure resource groups.

## Purpose

**Main Use Case:** Clean up non-demo resource groups while keeping demos SAFE.

Demo RGs (with keywords like "demo", "ignite", "build", "conference") are **protected** — they're filtered out so you don't accidentally delete them. The tool helps remove clutter (old projects, expired POCs, forgotten resources) while preserving demo environments.

## MCP Connection

**Endpoint:** `http://localhost:7071/runtime/webhooks/mcp`

Ensure server is running before using tools:
```bash
azurite --silent --location /tmp/azurite  # Terminal 1
cd mcp-function && func start              # Terminal 2
```

## Quick Reference

| Tool | Use For |
|------|---------|
| `list_resource_groups` | See all RGs with demo/exclusion flags |
| `delete_resource_groups` | Delete RGs (supports audit mode) |
| `get_exclude_patterns` | View protected RG patterns |
| `detect_demo_rgs` | Find demo RGs (these are PROTECTED) |

## Workflows

### User: "Show my resource groups"
```
1. list_resource_groups({includeExcluded: true})
2. Format as table:
   | Resource Group | Location | Demo? | Status |
   |----------------|----------|-------|--------|
   | rg-ignite-demo | eastus   | Yes   | Protected (demo) |
   | rg-old-project | westus   | No    | Can delete |
   | NetworkWatcherRG | westus | No    | Excluded (system) |
```

### User: "Clean up my subscription" / "What can I delete?"
```
1. list_resource_groups({includeExcluded: false})
2. Filter to RGs where isDemo: false (demos stay protected!)
3. Show: "Found 12 deletable RGs (5 demos protected): rg-old1, rg-test2..."
4. delete_resource_groups({names: "rg-old1,rg-test2", audit: true})
5. Show dry-run, ask confirmation
6. delete_resource_groups({names: "rg-old1,rg-test2", audit: false})
```

### User: "Delete rg-foo and rg-bar"
```
1. delete_resource_groups({names: "rg-foo,rg-bar", audit: true})
2. "This will delete 2 RGs. Proceed?"
3. On yes: delete_resource_groups({names: "rg-foo,rg-bar", audit: false})
```

### User: "Show my demos" / "What's protected?"
```
1. detect_demo_rgs()
2. Show demo RGs — these are SAFE from deletion
3. "You have 5 demo RGs that will be preserved: rg-ignite-demo, rg-build-2024..."
```

### User: "Why wasn't X deleted?"
```
1. get_exclude_patterns()
2. Show built-in patterns (DefaultResourceGroup*, MC_*, NetworkWatcher*)
3. Show custom patterns from exclude-list.txt
4. Also check if RG matched demo patterns
```

### User: "Delete everything except demos"
```
1. list_resource_groups({includeExcluded: false})
2. Get names where isDemo: false
3. Show list, confirm with user
4. delete_resource_groups({names: "...", audit: true})
5. delete_resource_groups({names: "...", audit: false})
```

### User: "How many RGs do I have?"
```
1. list_resource_groups({includeExcluded: true})
2. Summarize: "52 total: 8 demos (protected), 12 system (excluded), 32 deletable"
```

### User: "Clean up eastus region"
```
1. list_resource_groups({includeExcluded: false})
2. Filter: location === "eastus" AND isDemo === false
3. Show cleanup candidates for that region
```

## Parameter Format

**names:** Comma-separated string, not array
- ✅ `"rg-demo1,rg-test2,rg-foo"`
- ❌ `["rg-demo1", "rg-test2"]`

## Safety Rules

1. **Always audit first** - Use `audit: true` before real deletion
2. **Confirm with user** - Never delete without explicit confirmation
3. **Respect exclusions** - Excluded RGs are protected for a reason
4. **Warn about permanence** - Deletion cannot be undone

## Error Handling

- **Azure CLI not authenticated:** Tell user to run `az login`
- **Deletion fails:** Report specific RG and error message
- **Rate limited (429):** Tool handles retry automatically
- **RG has locks:** Inform user, suggest removing locks first
