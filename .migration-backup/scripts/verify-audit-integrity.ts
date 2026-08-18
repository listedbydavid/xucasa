import { pool } from "../server/db";

async function main() {
  console.log("=== Audit Integrity Verification ===\n");

  const checks: { name: string; pass: boolean; detail: string }[] = [];

  const totalResult = await pool.query("SELECT COUNT(*)::int AS count FROM audit_events");
  const totalCount = totalResult.rows[0].count;
  checks.push({
    name: "Audit events exist",
    pass: totalCount > 0,
    detail: `${totalCount} total audit events`,
  });

  const nullEventResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE event_type IS NULL OR event_type = ''"
  );
  const nullEventCount = nullEventResult.rows[0].count;
  checks.push({
    name: "No null/empty event types",
    pass: nullEventCount === 0,
    detail: nullEventCount === 0 ? "All events have types" : `${nullEventCount} events with null/empty event_type`,
  });

  const validOutcomeResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE outcome IS NOT NULL AND outcome NOT IN ('success', 'failure', 'error')"
  );
  const invalidOutcomeCount = validOutcomeResult.rows[0].count;
  checks.push({
    name: "All outcomes are valid",
    pass: invalidOutcomeCount === 0,
    detail: invalidOutcomeCount === 0 ? "All outcomes are success/failure/error" : `${invalidOutcomeCount} invalid outcomes`,
  });

  const orphanResult = await pool.query(
    `SELECT COUNT(*)::int AS count FROM audit_events ae 
     WHERE ae.actor_user_id IS NOT NULL 
     AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ae.actor_user_id)`
  );
  const orphanCount = orphanResult.rows[0].count;
  checks.push({
    name: "No orphaned user references",
    pass: orphanCount === 0,
    detail: orphanCount === 0 ? "All actor_user_id references are valid" : `${orphanCount} orphaned user references`,
  });

  const failureResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE outcome = 'failure'"
  );
  const failureCount = failureResult.rows[0].count;
  checks.push({
    name: "Failure events tracked",
    pass: true,
    detail: `${failureCount} failure events recorded`,
  });

  const retryResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE event_type IN ('audit_retry_attempt', 'audit_final_failure', 'audit_validation_failed')"
  );
  const retryCount = retryResult.rows[0].count;
  checks.push({
    name: "Audit system health events",
    pass: true,
    detail: `${retryCount} audit system health events (retries/failures/validation)`,
  });

  const eventDistResult = await pool.query(
    "SELECT event_type, COUNT(*)::int AS count FROM audit_events GROUP BY event_type ORDER BY count DESC LIMIT 15"
  );
  checks.push({
    name: "Event distribution",
    pass: true,
    detail: eventDistResult.rows.map((r: any) => `${r.event_type}: ${r.count}`).join(", "),
  });

  const recentResult = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE created_at > NOW() - INTERVAL '24 hours'"
  );
  checks.push({
    name: "Recent activity (24h)",
    pass: true,
    detail: `${recentResult.rows[0].count} events in last 24 hours`,
  });

  console.log("Results:\n");
  let allPass = true;
  for (const check of checks) {
    const icon = check.pass ? "\u2713" : "\u2717";
    const status = check.pass ? "PASS" : "FAIL";
    console.log(`  ${icon} [${status}] ${check.name}`);
    console.log(`    ${check.detail}\n`);
    if (!check.pass) allPass = false;
  }

  console.log("---");
  if (allPass) {
    console.log("All integrity checks passed.");
  } else {
    console.log("Some checks failed. Review the results above.");
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
