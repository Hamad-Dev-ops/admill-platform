const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");

/**
 * TS-aware linting (typescript-eslint) isn't installed: it currently peers on
 * TypeScript <6.1.0, and this project pins TypeScript ^7.0.2 (no stable release
 * supports 7.x yet). Instead this uses Babel's TS syntax parser, which strips
 * types without needing the `typescript` package's compiler API — so it parses
 * .ts files correctly, but gives no type-aware rules.
 *
 * Revisited at Milestone 11 (Hardening) as flagged: re-checked typescript-eslint's
 * published peer dependencies (`npm view typescript-eslint peerDependencies`) —
 * still `typescript: ">=4.8.4 <6.1.0"` as of this milestone, so TS 7.x remains
 * unsupported upstream. No local fix is safe (installing it anyway would violate
 * the peer constraint and risk silently-wrong type-aware rules against a TS
 * version it was never tested on). Keeping the current setup: Babel parser for
 * real JS-level linting, `tsc --noEmit` as the actual source of truth for type
 * correctness (already run as its own required step in CI and before every
 * milestone's completion, not a substitute being silently skipped). Revisit again
 * once typescript-eslint ships TS 7 support, or this project downgrades TypeScript.
 */
module.exports = [
  js.configs.recommended,
  prettier,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly" },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@babel/eslint-parser"),
      sourceType: "module",
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
        },
      },
    },
    rules: {
      // tsc (noUnusedLocals/noUnusedParameters) owns unused-var checking — it understands
      // type-only usages correctly; core no-unused-vars can't see through Babel-stripped
      // type annotations and flags type-only imports as false-positive unused.
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
