/**
 * When the keyword "deleteautomationtesting" is present (e.g. in a trigger file
 * in the project root), this script removes all automation (E2E) testing from
 * the project: tests/e2e/, playwright.config.js, e2e scripts and Playwright
 * deps from package.json, and the trigger file.
 *
 * Run: npm run deleteautomation
 * Trigger: create a file named "deleteautomationtesting" in the project root
 *          (no extension), or put the exact string "deleteautomationtesting"
 *          in that file.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TRIGGER_FILENAMES = ["deleteautomationtesting", ".deleteautomationtesting"];
const KEYWORD = "deleteautomationtesting";

function triggerPresent() {
  for (const name of TRIGGER_FILENAMES) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, "utf8").trim();
    if (content === "" || content.includes(KEYWORD)) return { path: p, name };
  }
  return null;
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) rmDir(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

function main() {
  const trigger = triggerPresent();
  if (!trigger) {
    console.log(
      "Keyword not found. To remove automation tests, create a file named 'deleteautomationtesting' in the project root and run: npm run deleteautomation"
    );
    process.exit(0);
    return;
  }

  const e2eDir = path.join(root, "tests", "e2e");
  const playwrightConfig = path.join(root, "playwright.config.js");

  if (fs.existsSync(e2eDir)) {
    rmDir(e2eDir);
    console.log("Removed tests/e2e/");
  }
  if (fs.existsSync(playwrightConfig)) {
    fs.unlinkSync(playwrightConfig);
    console.log("Removed playwright.config.js");
  }

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  let changed = false;
  if (pkg.scripts) {
    delete pkg.scripts["test:e2e"];
    delete pkg.scripts["test:e2e:ui"];
    delete pkg.scripts["deleteautomation"];
    changed = true;
  }
  if (pkg.devDependencies) {
    if (pkg.devDependencies["@playwright/test"]) {
      delete pkg.devDependencies["@playwright/test"];
      changed = true;
    }
    if (pkg.devDependencies["serve"]) {
      delete pkg.devDependencies["serve"];
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("Updated package.json (removed e2e scripts and Playwright/serve deps).");
  }

  try {
    fs.unlinkSync(trigger.path);
    console.log("Removed trigger file:", trigger.name);
  } catch (_unused) {}

  console.log("Automation testing removed. Run npm install to prune node_modules if needed.");
}

main();
