import { app, InvocationContext, arg } from "@azure/functions";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

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

interface ResourceGroup {
  name: string;
  location: string;
  isDemo: boolean;
  isExcluded: boolean;
}

interface DeleteResult {
  name: string;
  status: string;
  message?: string;
  reason?: string;
}

function loadExcludePatterns(): RegExp[] {
  const patterns = [...EXCLUDE_PATTERNS];
  const excludeListPath = process.env.EXCLUDE_LIST_PATH || path.join(__dirname, "..", "..", "exclude-list.txt");
  
  if (fs.existsSync(excludeListPath)) {
    const content = fs.readFileSync(excludeListPath, "utf-8");
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

function isExcluded(name: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(name));
}

function isDemo(name: string): boolean {
  return DEMO_PATTERNS.some(p => p.test(name));
}

function listResourceGroups(): ResourceGroup[] {
  const output = execSync('az group list --query "[].{name:name, location:location}" -o json', {
    encoding: "utf-8",
    timeout: 60000
  });
  const groups = JSON.parse(output) as Array<{ name: string; location: string }>;
  const excludePatterns = loadExcludePatterns();
  
  return groups.map(rg => ({
    name: rg.name,
    location: rg.location,
    isDemo: isDemo(rg.name),
    isExcluded: isExcluded(rg.name, excludePatterns)
  }));
}

function deleteResourceGroups(names: string[], audit: boolean = false): DeleteResult[] {
  const results: DeleteResult[] = [];
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
      // Stagger to avoid 429 rate limiting
      execSync("sleep 0.5");
    } catch (error) {
      results.push({ name, status: "error", message: (error as Error).message });
    }
  }
  
  return results;
}

// List Resource Groups Tool
export async function listResourceGroupsTool(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  context.log("Listing resource groups");
  
  const mcptoolargs = context.triggerMetadata.mcptoolargs as {
    includeExcluded?: boolean;
  };
  const includeExcluded = mcptoolargs?.includeExcluded !== false;
  
  try {
    let groups = listResourceGroups();
    if (!includeExcluded) {
      groups = groups.filter(g => !g.isExcluded);
    }
    
    return JSON.stringify({
      total: groups.length,
      excluded: groups.filter(g => g.isExcluded).length,
      demos: groups.filter(g => g.isDemo && !g.isExcluded).length,
      groups
    }, null, 2);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message });
  }
}

// Delete Resource Groups Tool
export async function deleteResourceGroupsTool(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  context.log("Delete resource groups request");
  
  const mcptoolargs = context.triggerMetadata.mcptoolargs as {
    names?: string;
    audit?: boolean;
  };
  
  const namesStr = mcptoolargs?.names;
  const audit = mcptoolargs?.audit ?? false;
  
  if (!namesStr || namesStr.trim() === "") {
    return JSON.stringify({ error: "names is required (comma-separated list of RG names)" });
  }
  
  const names = namesStr.split(",").map(n => n.trim()).filter(n => n.length > 0);
  
  if (names.length === 0) {
    return JSON.stringify({ error: "names must contain at least one resource group name" });
  }
  
  try {
    const results = deleteResourceGroups(names, audit);
    return JSON.stringify({
      mode: audit ? "audit" : "delete",
      results
    }, null, 2);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message });
  }
}

// Get Exclude Patterns Tool
export async function getExcludePatternsTool(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  context.log("Getting exclude patterns");
  
  const patterns: string[] = [];
  const excludeListPath = process.env.EXCLUDE_LIST_PATH || path.join(__dirname, "..", "..", "exclude-list.txt");
  
  if (fs.existsSync(excludeListPath)) {
    const content = fs.readFileSync(excludeListPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        patterns.push(trimmed);
      }
    }
  }
  
  return JSON.stringify({
    builtIn: EXCLUDE_PATTERNS.map(p => p.source),
    fromFile: patterns
  }, null, 2);
}

// Detect Demo RGs Tool
export async function detectDemoRgsTool(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  context.log("Detecting demo resource groups");
  
  try {
    const groups = listResourceGroups();
    const demos = groups.filter(g => g.isDemo && !g.isExcluded);
    
    return JSON.stringify({
      totalGroups: groups.length,
      demoCount: demos.length,
      demoGroups: demos.map(g => ({
        name: g.name,
        location: g.location,
        matchedPatterns: DEMO_PATTERNS
          .filter(p => p.test(g.name))
          .map(p => p.source.replace(/\\/g, ""))
      }))
    }, null, 2);
  } catch (error) {
    return JSON.stringify({ error: (error as Error).message });
  }
}

// Register MCP Tools
app.mcpTool("listResourceGroups", {
  toolName: "list_resource_groups",
  description: "List all Azure resource groups in the current subscription with demo detection and exclusion status. Returns each RG's name, location, whether it matches demo/event patterns (suggesting it's temporary), and whether it's excluded by configured patterns.",
  toolProperties: {
    includeExcluded: arg.boolean().describe("Include excluded resource groups in the output (default: true)").optional()
  },
  handler: listResourceGroupsTool
});

app.mcpTool("deleteResourceGroups", {
  toolName: "delete_resource_groups",
  description: "Delete one or more Azure resource groups. Supports audit mode for dry-run. Automatically skips excluded RGs and staggers deletions to avoid rate limiting. WARNING: This permanently deletes resources. Pass names as comma-separated string.",
  toolProperties: {
    names: arg.string().describe("Comma-separated list of resource group names to delete (e.g., 'rg-demo1,rg-test2')"),
    audit: arg.boolean().describe("If true, simulate deletion without actually deleting (default: false)").optional()
  },
  handler: deleteResourceGroupsTool
});

app.mcpTool("getExcludePatterns", {
  toolName: "get_exclude_patterns",
  description: "Get the current list of exclusion patterns that protect resource groups from deletion",
  toolProperties: {},
  handler: getExcludePatternsTool
});

app.mcpTool("detectDemoRgs", {
  toolName: "detect_demo_rgs",
  description: "Analyze resource groups and identify which ones appear to be temporary demo/test/event resources based on naming patterns",
  toolProperties: {},
  handler: detectDemoRgsTool
});
