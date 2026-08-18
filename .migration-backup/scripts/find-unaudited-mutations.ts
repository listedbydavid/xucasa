import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUDIT_CALLS = /executeWithAudit|audit\s*\(/g;

const ACCEPTED_EXCEPTIONS: Record<string, string> = {
  "POST /api/saved-properties": "User bookmarks — low-risk own-data CRUD",
  "PATCH /api/saved-properties": "User bookmarks — low-risk own-data CRUD",
  "DELETE /api/saved-properties": "User bookmarks — low-risk own-data CRUD",
  "POST /api/favorite-lists": "User bookmarks — low-risk own-data CRUD",
  "PATCH /api/favorite-lists": "User bookmarks — low-risk own-data CRUD",
  "DELETE /api/favorite-lists": "User bookmarks — low-risk own-data CRUD",
  "POST /api/search-history": "User search history — low-risk own-data",
  "DELETE /api/search-history": "User search history — low-risk own-data",
  "POST /api/my-homes": "User home tracking — low-risk own-data CRUD",
  "PATCH /api/my-homes": "User home tracking — low-risk own-data CRUD",
  "DELETE /api/my-homes": "User home tracking — low-risk own-data CRUD",
  "POST /api/agent/contacts": "Agent CRM — low-risk own-data CRUD",
  "PUT /api/agent/contacts": "Agent CRM — low-risk own-data CRUD",
  "DELETE /api/agent/contacts": "Agent CRM — low-risk own-data CRUD",
  "POST /api/agent/contacts/import-csv": "Agent CRM — low-risk own-data bulk import",
  "POST /api/agent/contacts/import-phone": "Agent CRM — low-risk own-data bulk import",
  "POST /api/agent/tags": "Agent CRM tags — low-risk own-data CRUD",
  "PUT /api/agent/tags": "Agent CRM tags — low-risk own-data CRUD",
  "DELETE /api/agent/tags": "Agent CRM tags — low-risk own-data CRUD",
  "POST /api/agent/contacts/": "Agent CRM tag assignment — low-risk own-data",
  "DELETE /api/agent/contacts/": "Agent CRM tag removal — low-risk own-data",
  "POST /api/buyer-profiles": "User buyer profile — low-risk own-data CRUD",
  "PATCH /api/buyer-profiles": "User buyer profile — low-risk own-data CRUD",
  "DELETE /api/buyer-profiles": "User buyer profile — low-risk own-data CRUD",
  "POST /api/agent/buyer-clients": "Agent buyer clients — low-risk own-data CRUD",
  "PATCH /api/agent/buyer-clients": "Agent buyer clients — low-risk own-data CRUD",
  "DELETE /api/agent/buyer-clients": "Agent buyer clients — low-risk own-data CRUD",
  "POST /api/notifications": "System notification creation — internal",
  "POST /api/notifications/test": "Test utility — non-security",
  "PATCH /api/notifications/mark-all-read": "User notification prefs — low-risk own-data",
  "PATCH /api/notifications/": "User notification update — low-risk own-data",
  "DELETE /api/notifications/": "User notification delete — low-risk own-data",
  "PATCH /api/notification-preferences": "User notification prefs — low-risk own-data",
  "POST /api/test-email": "Test utility — non-security",
  "POST /api/admin/test-email": "Test utility — non-security",
  "POST /api/error-reports": "Unauthenticated error reporting — rate-limited, no mutations",
  "POST /api/admin/cleanup/list": "Read-only query using POST for body params",
};

function isAcceptedException(method: string, route: string): string | null {
  const key = `${method} ${route}`;
  for (const [pattern, reason] of Object.entries(ACCEPTED_EXCEPTIONS)) {
    if (key === pattern || key.startsWith(pattern)) {
      return reason;
    }
  }
  return null;
}

interface UnauditedRoute {
  file: string;
  line: number;
  method: string;
  route: string;
  snippet: string;
  exception?: string;
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

    const blockEnd = Math.min(i + 100, lines.length);
    const block = lines.slice(i, blockEnd).join("\n");

    if (!AUDIT_CALLS.test(block)) {
      AUDIT_CALLS.lastIndex = 0;
      const exceptionReason = isAcceptedException(method, route);
      results.push({
        file: filePath,
        line: i + 1,
        method,
        route,
        snippet: `${method} ${route}`,
        exception: exceptionReason || undefined,
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
  let totalExceptions = 0;
  let totalScanned = 0;

  for (const file of routeFiles) {
    const unaudited = scanFile(file);
    if (unaudited.length > 0) {
      const relPath = path.relative(process.cwd(), file);
      console.log(`\n  ${relPath}:`);
      for (const r of unaudited) {
        if (r.exception) {
          console.log(`    Line ${r.line}: ${r.snippet} — ACCEPTED EXCEPTION: ${r.exception}`);
          totalExceptions++;
        } else {
          console.log(`    Line ${r.line}: ${r.snippet} — NO AUDIT DETECTED`);
          totalUnaudited++;
        }
      }
    }
    totalScanned++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Files scanned: ${totalScanned}`);
  console.log(`Unaudited mutation routes (must fix): ${totalUnaudited}`);
  console.log(`Accepted exceptions: ${totalExceptions}`);

  if (totalUnaudited === 0) {
    console.log("\nAll security-sensitive mutation routes have audit coverage.");
    if (totalExceptions > 0) {
      console.log(`${totalExceptions} low-risk routes are accepted exceptions (documented above).`);
    }
  } else {
    console.log("\nAction: Add executeWithAudit or audit() calls to the unaudited routes above.");
    process.exit(1);
  }
}

main();
