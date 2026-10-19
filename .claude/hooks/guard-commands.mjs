// PreToolUse hook: asks the user before commands that wipe or reset the dev database.
// CLAUDE.md: `npm run seed` deletes all data first.

/**
 * Reads the hook payload from stdin.
 *
 * @returns The parsed JSON payload.
 */
async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return JSON.parse(raw || "{}");
}

const RISKY = [
  { re: /\bnpm\s+run\s+seed\b|\bprisma\s+db\s+seed\b/, why: "the seed deletes all data in the dev database first" },
  { re: /\bprisma\s+migrate\s+reset\b/, why: "migrate reset drops and recreates the dev database" },
  { re: /\bprisma\s+db\s+push\b[^|;&]*--force-reset\b/, why: "db push --force-reset wipes the dev database" },
  { re: /\bdocker\s+compose\s+down\b[^|;&]*\s-v\b|\bnpm\s+run\s+db:down\b[^|;&]*\s-v\b/, why: "removing the volume deletes the MySQL data" },
];

const input = await readInput();
const command = String(input.tool_input?.command ?? "");
// The e2e/test databases are disposable: commands that target them explicitly don't need a prompt.
const targetsTestDb = /DATABASE_URL=\S*(_e2e|_test)\b/i.test(command);
const hit = !targetsTestDb && RISKY.find((r) => r.re.test(command));

if (hit) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `Careful: ${hit.why}. Approve only if losing local data is fine.`,
      },
    }),
  );
}
