#!/usr/bin/env node
/**
 * Agentic auto-fix: run lint --fix, Prettier, then tests.
 * Usage: node scripts/auto-fix.js   or   npm run auto-fix
 * Exit code: 0 if all pass, 1 otherwise.
 */
import { execSync } from "child_process";

const steps = [
  { name: "lint:fix", cmd: "npm run lint:fix" },
  { name: "format", cmd: "npm run format" },
  { name: "test", cmd: "npm test" },
];

let failed = null;
for (const step of steps) {
  try {
    execSync(step.cmd, { stdio: "inherit", cwd: process.cwd() });
  } catch (_e) {
    failed = step.name;
    process.exitCode = 1;
    break;
  }
}

if (failed) {
  console.error("\n[auto-fix] Failed at step: " + failed);
  process.exit(1);
} else {
  console.log("\n[auto-fix] All steps passed: lint:fix, format, test.");
}
