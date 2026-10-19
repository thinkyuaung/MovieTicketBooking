// PostToolUse hook: reminds Claude of files that must stay in sync (rules from CLAUDE.md).

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

const REMINDERS = [
  {
    re: /backend\/prisma\/schema\.prisma$/,
    text: "schema.prisma changed: run `npm run migrate` in backend/ to create a migration, update docs/er-diagram.md, and check prisma/seed.ts.",
  },
  { re: /backend\/src\/domain\/money\.ts$/, text: "backend money.ts changed: frontend/src/lib/money.ts must produce the same format." },
  { re: /frontend\/src\/lib\/money\.ts$/, text: "frontend money.ts changed: backend/src/domain/money.ts must produce the same format." },
  {
    re: /backend\/src\/(services\/[^/]+|routes\/schemas)\.ts$/,
    text: "Backend response or validation may have changed: keep frontend/src/lib/types.ts and .claude/rules/validation.md in sync, and add API tests.",
  },
];

const input = await readInput();
const filePath = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");
const notes = REMINDERS.filter((r) => r.re.test(filePath)).map((r) => r.text);

if (notes.length) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: notes.join("\n") } }));
}
