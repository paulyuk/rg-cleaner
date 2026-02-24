# RG Cleaner - Agent Instructions

This document provides instructions for AI agents using the rg-cleaner MCP tools.

## Getting Started

### 1. Start the MCP Server

```bash
cd mcp-function
npm install
func start
```

### 2. Connect via MCP

The server runs at `http://localhost:7071/runtime/webhooks/mcp`

See `.github/mcp/mcp.json` for the MCP configuration.

### Prerequisites

- Azure CLI installed and authenticated (`az login`)
- Azure Functions Core Tools (`npm i -g azure-functions-core-tools@4`)
- User must have permissions to list/delete resource groups

## Available Tools

### `list_resource_groups`
Lists all Azure resource groups with metadata about demo detection and exclusion status.

**Use when:**
- User asks to see their resource groups
- Before deleting, to show what's available
- To identify cleanup candidates

**Parameters:**
- `includeExcluded` (boolean, default: true): Whether to show excluded RGs

**Response includes:**
- `total`: Total RG count
- `excluded`: Count of excluded RGs  
- `demos`: Count of detected demo/temp RGs
- `groups[]`: Array with name, location, isDemo, isExcluded

### `delete_resource_groups`
Deletes specified resource groups with safety checks.

**Use when:**
- User explicitly asks to delete resource groups
- User confirms deletion after reviewing list

**Parameters:**
- `names` (string[], required): Array of RG names to delete
- `audit` (boolean, default: false): If true, simulate without deleting

**Safety features:**
- Automatically skips excluded RGs
- Staggers deletions to avoid Azure rate limits
- Returns status for each RG

### `get_exclude_patterns`
Shows current exclusion patterns protecting RGs from deletion.

**Use when:**
- User asks what's protected
- User wants to understand why an RG wasn't deleted
- Before modifying exclude-list.txt

### `detect_demo_rgs`
Identifies RGs that appear to be temporary based on naming patterns.

**Use when:**
- User asks to find cleanup candidates
- User wants to clean up demo/test resources
- Initial triage of subscription

## Recommended Workflows

### Safe Cleanup Flow
1. Call `list_resource_groups` to show all RGs
2. Call `detect_demo_rgs` to identify likely temporary RGs
3. Present findings to user and ask for confirmation
4. Call `delete_resource_groups` with `audit: true` first
5. On user confirmation, call `delete_resource_groups` with `audit: false`

### Quick Demo Cleanup
```
1. detect_demo_rgs → get list of demo RGs
2. Present list: "Found X demo RGs. Delete them?"
3. If yes: delete_resource_groups(names, audit=false)
```

## Demo Detection Patterns

The following patterns suggest a temporary/demo RG:
- Keywords: demo, test, temp, tmp, scratch, playground, sandbox, trial, poc, prototype, experiment
- Events: ignite, build, msbuild, reinvent, summit, conference, workshop, hackathon
- Cities: orlando, seattle, vegas, austin, chicago, boston, etc.

## Exclusion Patterns

Built-in exclusions (always protected):
- `^DefaultResourceGroup` - Azure default RGs
- `^NetworkWatcherRG$` - Network monitoring
- `^cloud-shell-storage-` - Cloud Shell
- `_managed$` - Azure managed RGs
- `^MC_` - AKS managed clusters
- `^AzureBackupRG_` - Backup service
- `^databricks-rg-` - Databricks managed

Additional patterns loaded from `exclude-list.txt`.

## Safety Guidelines

1. **Always use audit mode first** when unsure
2. **Never delete without user confirmation** for production-looking RGs
3. **Check exclusion patterns** before assuming an RG can be deleted
4. **Warn users** that deletion is permanent and cannot be undone
5. **Report failures** - some RGs may fail due to locks or dependencies
