import fs from "fs";
import path from "path";

const ROUTE_DIRS = [
  path.resolve(__dirname, "../server/routes.ts"),
  path.resolve(__dirname, "../server/replit_integrations/auth/replitAuth.ts"),
];

const MUTATION_METHODS = /\bapp\.(post|put|patch|delete)\s*\(/gi;
const AUDIT_CALLS = /executeWithAudit|audit\s*\(/g;

interface UnauditedRoute {
  file: string;
  line: number;
  method: string;
  snippet: string;
}

function scanFile(filePath: string): UnauditedRoute[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const results: UnauditedRoute[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/app\.(post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/i);
    if (!match) continue;

    const method = match[1].toUpperCase();
    const route = match[2];

    const blockEnd = Math.min(i + 50, lines.length);
    const block = lines.slice(i, blockEnd).join("\n");

    if (!AUDIT_CALLS.test(block)) {
      AUDIT_CALLS.lastIndex = 0;
      results.push({
        file: filePath,
        line: i + 1,
        method,
        snippet: `${method} ${route}`,
      });
    }
    AUDIT_CALLS.lastIndex = 0;
  }

  return results;
}

function findRouteFiles(): string[] {
  const serverDir = path.resolve(__dirname, "../server");
  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(fullPath);
      } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(serverDir);
  return files;
}

function main() {
  console.log("=== Find Unaudited Mutation Routes ===\n");

  const routeFiles = findRouteFiles();
  let totalUnaudited = 0;
  let totalScanned = 0;

  for (const file of routeFiles) {
    const unaudited = scanFile(file);
    if (unaudited.length > 0) {
      const relPath = path.relative(process.cwd(), file);
      console.log(`\n  ${relPath}:`);
      for (const r of unaudited) {
        console.log(`    Line ${r.line}: ${r.snippet} — NO AUDIT DETECTED`);
        totalUnaudited++;
      }
    }
    totalScanned++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Files scanned: ${totalScanned}`);
  console.log(`Unaudited mutation routes: ${totalUnaudited}`);

  if (totalUnaudited === 0) {
    console.log("\nAll mutation routes appear to have audit coverage.");
  } else {
    console.log("\nAction: Add executeWithAudit or audit() calls to the routes above.");
    process.exit(1);
  }
}

main();
