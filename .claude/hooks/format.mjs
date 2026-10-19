// PostToolUse hook: formats the file Claude just wrote with the project's Prettier.
// Files Prettier can't parse or that .prettierignore lists are skipped.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

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

const input = await readInput();
const filePath = input.tool_input?.file_path ?? input.tool_response?.filePath;
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const prettier = path.join(root, "node_modules", "prettier", "bin", "prettier.cjs");

if (filePath && existsSync(filePath) && existsSync(prettier)) {
  try {
    await run(process.execPath, [prettier, "--write", "--ignore-unknown", "--log-level", "warn", filePath], { cwd: root });
  } catch (err) {
    // A syntax error means the edit itself is broken; tell Claude instead of failing silently.
    console.error(`Prettier could not format ${filePath}:\n${err.stderr || err.message}`);
    process.exit(2);
  }
}
