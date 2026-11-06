# Security practices

How this repository keeps the package and its users safe. The disclosure policy is in [../SECURITY.md](../SECURITY.md).

## Threat model

The package reads Markdown and `.mmd` files chosen by the caller, and optionally runs one external command chosen by the caller.

Defended:

- Oversized input: Markdown over 5 MiB (UTF-16 code units) and files over 5 MiB are rejected with `input_too_large`. A file with more than 1000 diagrams is rejected. The CLI stops at more than 10000 files and at directory nesting deeper than 32 levels.
- Symbolic links: the CLI does not follow symbolic links while walking directories.
- Command injection: `createCommandRenderer` runs the command with `shell: false` and passes the temporary file as a separate argument.
- Hung renderers: the command is killed after 20000 ms by default (configurable with `timeoutMs`). Its standard output is limited to 10 MB.
- Temporary files: the source is written to a directory created with `mkdtemp` in the OS temp directory, and that directory is removed after each render.
- Output size: renderer messages and error messages are cut to 200 characters. The SVG output is never stored.
- Log injection: text output replaces CR and LF in messages with spaces; GitHub output escapes `%`, CR, LF, `:` and `,` as required by the workflow command format.

Not defended:

- A renderer command is trusted code. It runs with the privileges of the caller and can read any file that the caller can read. The library does not sandbox it.
- The timeout bounds only the renderer. Structural linting has no time limit beyond the size and count limits above.
- Files are read fully into memory before checking. Memory use can reach several times the size limits.
- Symbolic links are not followed only during directory walking; a symbolic link given directly as a path is handled by `lstat` and skipped.
- The linter is heuristic. A diagram that passes can still fail in Mermaid, and a diagram that fails can still render.

## Secrets

- No secrets, tokens or credentials in the repository, commit history, logs or prompts.
- `gitleaks` runs as the last step of `npm run check` and as a dedicated CI job. Its configuration is `.gitleaks.toml`.
- Publishing credentials live only in the CI secret store or the maintainer's local npm configuration.

## Dependencies

- The package has no runtime dependencies. Development dependencies are limited to the toolchain listed in [STACK.md](STACK.md).
- Dependabot opens weekly updates for npm packages and GitHub Actions.
- Commit the generated `package-lock.json` so installs are reproducible.

## Code

- No `eval`, no dynamic `Function` construction.
- The only process spawn is `execFile` in `src/node.ts`, with `shell: false`.
- Inputs from callers are checked: unknown CLI options and invalid `--format` values return exit code 2 with a usage message.

## Publishing

- Packages are published from a clean checkout after `npm run check` passes.
- Only `dist/` is included in the published tarball.
