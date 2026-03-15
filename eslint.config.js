/**
 * ESLint flat config — app and tests. Run with --fix to auto-fix issues.
 * Only lints: app/js, server, scripts, tests/unit, tests/api.
 */
import js from "@eslint/js";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/*.min.js",
      "app/firebase-messaging-sw.js",
      "**/vitest*.config.js",
      "playwright.config.js",
      "tests/setup.js",
      "tests/e2e/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["app/js/**/*.js", "server/**/*.js", "scripts/**/*.js", "tests/unit/**/*.js", "tests/api/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        self: "readonly",
        navigator: "readonly",
        location: "readonly",
        alert: "readonly",
        confirm: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        FormData: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        encodeURIComponent: "readonly",
        decodeURIComponent: "readonly",
        process: "readonly",
        global: "readonly",
        CONFIG: "readonly",
        MOCK: "readonly",
        firebase: "readonly",
        supabase: "readonly",
        AuthService: "writable",
        SupabaseService: "writable",
        ChatService: "writable",
        GeolocationService: "writable",
        FirebaseAuthService: "writable",
        OneSignalService: "writable",
        NotificationService: "writable",
        OSMCourtsService: "writable",
        AVATAR_OPTIONS: "writable",
        Notification: "readonly",
        vi: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern:
            "^(_.*|AVATAR_OPTIONS|MOCK|AuthService|SupabaseService|ChatService|GeolocationService|FirebaseAuthService|OneSignalService|NotificationService|OSMCourtsService)$",
        },
      ],
      "no-console": "off",
      "no-prototype-builtins": "off",
      "no-redeclare": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["server/**/*.js", "scripts/**/*.js", "tests/unit/**/*.js", "tests/api/**/*.js"],
    languageOptions: { sourceType: "module" },
  },
  {
    files: ["app/js/**/*.js"],
    languageOptions: { sourceType: "script" },
  },
];
