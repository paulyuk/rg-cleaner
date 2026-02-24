# Azure Preparation Manifest

## Project: rg-cleaner-mcp

### Overview
MCP server for Azure Resource Group Cleaner - provides AI agents with tools to list, analyze, and delete Azure resource groups.

### Configuration

| Setting | Value |
|---------|-------|
| Subscription | Default |
| Region | East US |
| Recipe | AZD |
| Template | remote-mcp-functions-typescript |

### Services

| Service | Type | Language | Host |
|---------|------|----------|------|
| api | MCP Server | TypeScript | Azure Functions (Flex Consumption) |

### MCP Tools Exposed

| Tool | Description |
|------|-------------|
| `list_resource_groups` | List all RGs with demo detection and exclusion status |
| `delete_resource_groups` | Delete RGs with audit mode support |
| `get_exclude_patterns` | Get exclusion patterns |
| `detect_demo_rgs` | Find temporary/demo RGs |

### Infrastructure

- Azure Functions (Flex Consumption plan)
- User-assigned managed identity
- Application Insights
- Storage Account

### Artifacts

| Artifact | Location |
|----------|----------|
| AZD Config | `mcp-function/azure.yaml` |
| Infrastructure | `mcp-function/infra/` |
| Source | `mcp-function/src/` |
| MCP Config | `.github/mcp/mcp.json` |

### Prerequisites for Deployment

1. Azure CLI authenticated (`az login`)
2. Azure Developer CLI installed (`azd`)
3. Node.js 18+

### Deployment Commands

```bash
cd mcp-function
azd up
```

### Next Steps

- Run `azd up` to deploy to Azure
- Connect agents using the MCP endpoint from deployment output
