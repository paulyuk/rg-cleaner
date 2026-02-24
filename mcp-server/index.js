#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCLUDE_LIST_PATH = join(__dirname, "..", "exclude-list.txt");

// Demo/event detection patterns (same as bash script)
const DEMO_PATTERNS = [
  /demo/i, /test/i, /temp/i, /tmp/i, /scratch/i, /playground/i,
  /sandbox/i, /trial/i, /poc/i, /prototype/i, /experiment/i,
  /ignite/i, /build/i, /msbuild/i, /reinvent/i, /summit/i,
  /conference/i, /workshop/i, /hackathon/i, /meetup/i, /devday/i,
  /techready/i, /teched/i, /connect/i, /evolve/i, /inspire/i,
  /orlando/i, /seattle/i, /vegas/i, /austin/i, /chicago/i,
  /boston/i, /atlanta/i, /denver/i, /portland/i, /sanfrancisco/i,
  /losangeles/i, /newyork/i, /london/i, /paris/i, /berlin/i,
  /sydney/i, /singapore/i, /tokyo/i, /amsterdam/i
];

const EXCLUDE_PATTERNS = [
  /^DefaultResourceGroup/i,
  /^NetworkWatcherRG$/i,
  /^cloud-shell-storage-/i,
  /_managed$/i,
  /^MC_/i,
  /^AzureBackupRG_/i,
  /^databricks-rg-/i
];

function loadExcludePatterns() {
  const patterns = [...EXCLUDE_PATTERNS];
  if (existsSync(EXCLUDE_LIST_PATH)) {
    const content = readFileSync(EXCLUDE_LIST_PATH, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        try {
          patterns.push(new RegExp(trimmed, "i"));
        } catch (e) {
          // Invalid regex, skip
        }
      }
    }
  }
  return patterns;
}

function isExcluded(name, patterns) {
  return patterns.some(p => p.test(name));
}

function isDemo(name) {
  return DEMO_PATTERNS.some(p => p.test(name));
}

function listResourceGroups() {
  try {
    const output = execSync("az group list --query \"[].{name:name, location:location}\" -o json", {
      encoding: "utf-8",
      timeout: 60000
    });
    const groups = JSON.parse(output);
    const excludePatterns = loadExcludePatterns();
    
    return groups.map(rg => ({
      name: rg.name,
      location: rg.location,
      isDemo: isDemo(rg.name),
      isExcluded: isExcluded(rg.name, excludePatterns)
    }));
  } catch (error) {
    throw new Error(`Failed to list resource groups: ${error.message}`);
  }
}

function deleteResourceGroups(names, audit = false) {
  const results = [];
  const excludePatterns = loadExcludePatterns();
  
  for (const name of names) {
    if (isExcluded(name, excludePatterns)) {
      results.push({
        name,
        status: "skipped",
        reason: "excluded by pattern"
      });
      continue;
    }
    
    if (audit) {
      results.push({
        name,
        status: "audit",
        message: `Would delete resource group: ${name}`
      });
      continue;
    }
    
    try {
      execSync(`az group delete --name "${name}" --yes --no-wait`, {
        encoding: "utf-8",
        timeout: 30000
      });
      results.push({
        name,
        status: "deleting",
        message: `Deletion initiated for: ${name}`
      });
      // Stagger deletions to avoid 429 rate limiting
      execSync("sleep 0.5");
    } catch (error) {
      results.push({
        name,
        status: "error",
        message: error.message
      });
    }
  }
  
  return results;
}

// Create MCP server
const server = new Server(
  {
    name: "rg-cleaner-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_resource_groups",
        description: "List all Azure resource groups in the current subscription with demo detection and exclusion status. Returns each RG's name, location, whether it matches demo/event patterns (suggesting it's temporary), and whether it's excluded by configured patterns.",
        inputSchema: {
          type: "object",
          properties: {
            includeExcluded: {
              type: "boolean",
              description: "Include excluded resource groups in the output (default: true)",
              default: true
            }
          }
        }
      },
      {
        name: "delete_resource_groups",
        description: "Delete one or more Azure resource groups. Supports audit mode for dry-run. Automatically skips excluded RGs and staggers deletions to avoid rate limiting. WARNING: This permanently deletes resources.",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Array of resource group names to delete"
            },
            audit: {
              type: "boolean", 
              description: "If true, simulate deletion without actually deleting (default: false)",
              default: false
            }
          },
          required: ["names"]
        }
      },
      {
        name: "get_exclude_patterns",
        description: "Get the current list of exclusion patterns that protect resource groups from deletion",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "detect_demo_rgs",
        description: "Analyze resource groups and identify which ones appear to be temporary demo/test/event resources based on naming patterns",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case "list_resource_groups": {
        const includeExcluded = args?.includeExcluded !== false;
        let groups = listResourceGroups();
        
        if (!includeExcluded) {
          groups = groups.filter(g => !g.isExcluded);
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              total: groups.length,
              excluded: groups.filter(g => g.isExcluded).length,
              demos: groups.filter(g => g.isDemo && !g.isExcluded).length,
              groups
            }, null, 2)
          }]
        };
      }
      
      case "delete_resource_groups": {
        if (!args?.names || !Array.isArray(args.names) || args.names.length === 0) {
          throw new Error("names array is required and must not be empty");
        }
        
        const results = deleteResourceGroups(args.names, args.audit || false);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mode: args.audit ? "audit" : "delete",
              results
            }, null, 2)
          }]
        };
      }
      
      case "get_exclude_patterns": {
        const patterns = [];
        if (existsSync(EXCLUDE_LIST_PATH)) {
          const content = readFileSync(EXCLUDE_LIST_PATH, "utf-8");
          for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
              patterns.push(trimmed);
            }
          }
        }
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              builtIn: EXCLUDE_PATTERNS.map(p => p.source),
              fromFile: patterns,
              filePath: EXCLUDE_LIST_PATH
            }, null, 2)
          }]
        };
      }
      
      case "detect_demo_rgs": {
        const groups = listResourceGroups();
        const demos = groups.filter(g => g.isDemo && !g.isExcluded);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalGroups: groups.length,
              demoCount: demos.length,
              demoGroups: demos.map(g => ({
                name: g.name,
                location: g.location,
                matchedPatterns: DEMO_PATTERNS
                  .filter(p => p.test(g.name))
                  .map(p => p.source.replace(/\\/g, ""))
              }))
            }, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: error.message })
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("rg-cleaner MCP server running");
}

main().catch(console.error);
