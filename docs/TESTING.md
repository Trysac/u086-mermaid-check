# Testing

## Tools

- [Vitest](https://vitest.dev/) runs the suites in `test/`.
- Coverage is collected with V8 (`@vitest/coverage-v8`) over `src/`.

## Commands

```sh
npm test            # vitest run --coverage
npx vitest          # watch mode while developing
npm run check       # every gate, including tests
```

## Test files

- `test/index.test.ts`: extraction of fences (backtick and tilde, list item content column, unclosed fences, closing fence length, Markdown and diagram count limits), type detection, every code MMD001 to MMD007, block keyword balancing, bracket and quote checks, `checkMarkdown` with the fake renderer (message truncation to 200 characters, renderer throws, start failures), issue sorting, and `formatIssues` in text and GitHub formats.
- `test/cli.test.ts`: `run()` exit codes 0, 1 and 2, text and GitHub output, `.mmd` files, ignored extensions, directory walking without following symbolic links, usage errors, missing paths and renderer start failure.
- `test/node.test.ts`: `createCommandRenderer` with the Node executable: success, non-zero exit with stderr, fallback message, timeout, and rejection with `renderer_failed_to_start` when the command does not exist.

## Rules

- Coverage must stay at or above 80 % for lines, branches, functions and statements (`vitest.config.ts`). Lowering the thresholds is not allowed.
- Test through the public entry points (`src/index.ts`, `src/cli.ts`, `src/node.ts`) and assert observable behavior: return values, thrown errors and their messages.
- Each bug fix adds a test that fails without the fix.
- Tests are deterministic: no network, no real clock or randomness without injection, no shared state between tests. Temporary files go to the OS temp directory. The renderer tests use the Node executable as the external command.

## Reports

Coverage reports are written to `coverage/` (text summary and `lcov`). The folder is ignored by git.
