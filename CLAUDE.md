# Claude Instructions for RG Cleaner

You have access to the **rg-cleaner** MCP server for managing Azure resource groups.

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
| `detect_demo_rgs` | Find cleanup candidates |

## Workflows

### User: "Show my resource groups"
```
1. list_resource_groups({includeExcluded: true})
2. Format as table:
   | Resource Group | Location | Demo? | Status |
   |----------------|----------|-------|--------|
   | rg-ignite-demo | eastus   | Yes   | Can delete |
   | NetworkWatcherRG | westus | No    | Excluded |
```

### User: "Clean up my demo RGs"
```
1. detect_demo_rgs() → get demo RG names
2. Show: "Found 5 demo RGs: rg-test1, rg-demo2... Delete them?"
3. delete_resource_groups({names: "rg-test1,rg-demo2", audit: true})
4. Show dry-run results, ask confirmation
5. delete_resource_groups({names: "rg-test1,rg-demo2", audit: false})
```

### User: "Delete rg-foo and rg-bar"
```
1. delete_resource_groups({names: "rg-foo,rg-bar", audit: true})
2. "This will delete 2 RGs. Proceed?"
3. On yes: delete_resource_groups({names: "rg-foo,rg-bar", audit: false})
```

### User: "What's protected?"
```
1. get_exclude_patterns()
2. Show built-in patterns (DefaultResourceGroup*, MC_*, etc.)
3. Show custom patterns from exclude-list.txt
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
