# Claude Instructions for RG Cleaner

You have access to the **rg-cleaner** MCP server which helps manage Azure resource groups.

## Quick Reference

| Tool | Use For |
|------|---------|
| `list_resource_groups` | See all RGs with demo/exclusion flags |
| `delete_resource_groups` | Delete RGs (supports audit mode) |
| `get_exclude_patterns` | View protected RG patterns |
| `detect_demo_rgs` | Find cleanup candidates |

## Common Tasks

### "Clean up my demo RGs"
```
1. detect_demo_rgs → get list
2. Show user the list
3. delete_resource_groups(names, audit=true) → dry run
4. On confirmation: delete_resource_groups(names, audit=false)
```

### "What resource groups do I have?"
```
list_resource_groups(includeExcluded=true)
```

### "Delete these specific RGs: rg-test1, rg-test2"
```
1. delete_resource_groups(["rg-test1", "rg-test2"], audit=true)
2. Show results, ask for confirmation
3. delete_resource_groups(["rg-test1", "rg-test2"], audit=false)
```

## Safety Rules

1. **Always audit first** - Use `audit: true` before real deletion
2. **Confirm with user** - Never delete without explicit confirmation
3. **Respect exclusions** - Excluded RGs are protected for a reason
4. **Warn about permanence** - Deletion cannot be undone

## Response Format

When listing RGs, format as a clear table:
```
| Resource Group | Location | Demo? | Status |
|----------------|----------|-------|--------|
| rg-ignite-demo | eastus   | Yes   | Can delete |
| rg-production  | westus2  | No    | Excluded |
```

## Error Handling

- If Azure CLI not authenticated: Tell user to run `az login`
- If deletion fails: Report the specific RG and error
- If rate limited (429): Tool handles retry automatically
