# Automation (E2E) testing

Automation tests use **Playwright** to run initial/smoke tests in a real browser: app loads, nav (Home, Courts, Chat, Profile) works, and main content is visible.

## Run automation tests

```bash
npm install
npm run test:e2e
```

Optional: `npm run test:e2e:ui` for the Playwright UI.

Tests start a static server for the `app/` folder on port 3080 and run against it.

---

## Remove automation testing (keyword: `deleteautomationtesting`)

When you want to **delete all automation testing** from the project:

1. **Option A – Trigger file**  
   Create a file in the project root named exactly:
   - `deleteautomationtesting` (no extension), or  
   - `.deleteautomationtesting`  
   Then run:
   ```bash
   npm run deleteautomation
   ```
   The script will:
   - Remove `tests/e2e/`
   - Remove `playwright.config.js`
   - Remove `test:e2e`, `test:e2e:ui`, and `deleteautomation` from `package.json`
   - Remove `@playwright/test` and `serve` from `devDependencies`
   - Delete the trigger file

2. **Option B – Ask the AI**  
   In Cursor, say: **deleteautomationtesting**  
   The project’s rule tells the AI to remove the automation test suite and related config when it sees that keyword.

After removal, run `npm install` to prune `node_modules` if needed.
