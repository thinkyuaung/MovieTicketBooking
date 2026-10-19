// PreToolUse hook: blocks Claude from changing env files and applied migrations.
// Exit code 2 blocks the tool call and shows stderr to Claude.
import { basename } from "node:path";

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

/**
 * Returns why a file must not be edited, or null if it may be.
 *
 * @param filePath - Path from the tool input.
 * @returns The reason, or null.
 */
function protectedReason(filePath) {
  const name = basename(filePath);
  const normalized = filePath.replaceAll("\\", "/");
  if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
    return `${name} holds local secrets and settings. Don't edit env files; ask the user to change it, or edit .env.example for documented defaults.`;
  }
  if (/\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(normalized)) {
    return "Applied Prisma migrations must not be edited. Change backend/prisma/schema.prisma and run `npm run migrate` to create a new migration.";
  }
  return null;
}

/** Shell commands that write to a .env file (but not .env.example). */
const ENV_WRITE = [
  />>?\s*["']?[^\s"']*\.env(\.(?!example\b)\w+)?["']?(\s|$)/, // echo x > .env
  /\b(sed|perl)\b[^|;&]*\s-i\b[^|;&]*\.env(?!\.example)\b/, // sed -i ... .env
  /\b(cp|mv|tee|install)\b[^|;&]*\s["']?[^\s"']*\.env(?!\.example)["']?\s*($|[|;&])/, // cp x .env
  /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Clear-Content|Copy-Item|Move-Item)\b[^|;]*\.env(?!\.example)\b/i,
  /\brm\b[^|;&]*\.env(?!\.example)\b/,
];

const input = await readInput();
const toolInput = input.tool_input ?? {};

if (input.tool_name === "Bash" || input.tool_name === "PowerShell") {
  const command = String(toolInput.command ?? "");
  if (ENV_WRITE.some((re) => re.test(command))) {
    console.error("This command would change an env file. Don't modify .env files; ask the user to change them.");
    process.exit(2);
  }
} else {
  const filePath = toolInput.file_path ?? toolInput.notebook_path ?? "";
  const reason = filePath && protectedReason(filePath);
  if (reason) {
    console.error(reason);
    process.exit(2);
  }
}
