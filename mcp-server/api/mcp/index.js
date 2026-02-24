const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const EXCLUDE_LIST_PATH = path.join(__dirname, "..", "..", "..", "exclude-list.txt");

// Demo/event detection patterns
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
  if (fs.existsSync(EXCLUDE_LIST_PATH)) {
    const content = fs.readFileSync(EXCLUDE_LIST_PATH, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        try {
          patterns.push(new RegExp(trimmed, "i"));
        } catch (e) { }
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
  const output = execSync('az group list --query "[].{name:name, location:location}" -o json', {
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
}

function deleteResourceGroups(names, audit = false) {
  const results = [];
  const excludePatterns = loadExcludePatterns();
  
  for (const name of names) {
    if (isExcluded(name, excludePatterns)) {
      results.push({ name, status: "skipped", reason: "excluded by pattern" });
      continue;
    }
    
    if (audit) {
      results.push({ name, status: "audit", message: `Would delete: ${name}` });
      continue;
    }
    
    try {
      execSync(`az group delete --name "${name}" --yes --no-wait`, {
        encoding: "utf-8",
        timeout: 30000
      });
      results.push({ name, status: "deleting", message: `Deletion initiated: ${name}` });
      execSync("sleep 0.5");
    } catch (error) {
      results.push({ name, status: "error", message: error.message });
    }
  }
  
  return results;
}

// Tool definitions for MCP
const TOOLS = [
  {
    name: "list_resource_groups",
    description: "List all Azure resource groups with demo detection and exclusion status",
    inputSchema: {
      type: "object",
      properties: {
        includeExcluded: { type: "boolean", description: "Include excluded RGs", default: true }
      }
    }
  },
  {
    name: "delete_resource_groups",
    description: "Delete resource groups. WARNING: Permanent deletion.",
    inputSchema: {
      type: "object",
      properties: {
        names: { type: "array", items: { type: "string" }, description: "RG names to delete" },
        audit: { type: "boolean", description: "Dry-run mode", default: false }
      },
      required: ["names"]
    }
  },
  {
    name: "get_exclude_patterns",
    description: "Get exclusion patterns protecting RGs from deletion",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "detect_demo_rgs",
    description: "Find temporary/demo resource groups",
    inputSchema: { type: "object", properties: {} }
  }
];

// Handle MCP requests
function handleToolsList() {
  return { tools: TOOLS };
}

function handleToolCall(name, args) {
  switch (name) {
    case "list_resource_groups": {
      const includeExcluded = args?.includeExcluded !== false;
      let groups = listResourceGroups();
      if (!includeExcluded) groups = groups.filter(g => !g.isExcluded);
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
      if (!args?.names?.length) throw new Error("names array required");
      const results = deleteResourceGroups(args.names, args.audit || false);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ mode: args.audit ? "audit" : "delete", results }, null, 2)
        }]
      };
    }
    
    case "get_exclude_patterns": {
      const patterns = [];
      if (fs.existsSync(EXCLUDE_LIST_PATH)) {
        const content = fs.readFileSync(EXCLUDE_LIST_PATH, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) patterns.push(trimmed);
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            builtIn: EXCLUDE_PATTERNS.map(p => p.source),
            fromFile: patterns
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
              matchedPatterns: DEMO_PATTERNS.filter(p => p.test(g.name)).map(p => p.source.replace(/\\/g, ""))
            }))
          }, null, 2)
        }]
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = async function (context, req) {
  const body = req.body;
  
  try {
    let result;
    
    // MCP JSON-RPC style requests
    if (body.method === "tools/list") {
      result = handleToolsList();
    } else if (body.method === "tools/call") {
      result = handleToolCall(body.params?.name, body.params?.arguments);
    } else if (body.jsonrpc) {
      // Standard JSON-RPC 2.0
      if (body.method === "tools/list") {
        result = { jsonrpc: "2.0", id: body.id, result: handleToolsList() };
      } else if (body.method === "tools/call") {
        result = { jsonrpc: "2.0", id: body.id, result: handleToolCall(body.params?.name, body.params?.arguments) };
      } else {
        result = { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } };
      }
      context.res = { status: 200, body: result, headers: { "Content-Type": "application/json" } };
      return;
    } else {
      // Direct tool call (simplified)
      if (body.tool) {
        result = handleToolCall(body.tool, body.arguments || {});
      } else {
        result = { error: "Invalid request. Use {method: 'tools/list'} or {method: 'tools/call', params: {name, arguments}}" };
      }
    }
    
    context.res = { status: 200, body: result, headers: { "Content-Type": "application/json" } };
  } catch (error) {
    context.res = {
      status: 500,
      body: { error: error.message },
      headers: { "Content-Type": "application/json" }
    };
  }
};
