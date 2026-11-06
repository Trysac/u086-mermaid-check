# mermaid-check

[![npm version](https://img.shields.io/npm/v/@trysac/mermaid-check.svg)](https://www.npmjs.com/package/@trysac/mermaid-check)
[![license: MIT](https://img.shields.io/npm/l/@trysac/mermaid-check.svg)](LICENSE)
[![CI](https://github.com/Trysac/u086-mermaid-check/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u086-mermaid-check/actions/workflows/ci.yml)

A browser-free linter that finds Mermaid diagrams in Markdown and reports common structural mistakes with line numbers. An optional external renderer can be plugged in for a stricter check.

## Problem

Mermaid diagrams in documentation break silently: a typo, or a node named `end`, makes GitHub show an error box instead of the diagram. The official mermaid-cli needs Puppeteer and Chromium in CI and stops at the first error. This package finds diagrams in Markdown and reports structural errors with line numbers, all at once and without a browser.

**This linter is heuristic.** It does not guarantee that Mermaid's parser accepts a diagram. Use the optional external renderer (`createCommandRenderer`) for that check.

## Install

```sh
npm install @trysac/mermaid-check
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { checkMarkdown, formatIssues } from "@trysac/mermaid-check";

const md = "```mermaid\nflowchart TD\nA --> end\n```\n";
const issues = await checkMarkdown(md, "docs/a.md");
console.log(formatIssues(issues, "text"));
// docs/a.md:3: MMD005 lowercase 'end' used as a node id; write it as 'End' or quote it
```

`createCommandRenderer` is exported from `@trysac/mermaid-check/node` and is the only Node-specific export. The core imports nothing from `node:`.

## API

| Export | Signature | Description |
|---|---|---|
| `extractDiagrams` | `(markdown: string, file?: string) => Diagram[]` | Finds fenced Mermaid diagrams. Throws `input_too_large` for more than 1000 diagrams or input over 5 MiB. |
| `validateDiagram` | `(diagram: Diagram) => Issue[]` | Structural lint of one diagram. Returns issues sorted by line and code. |
| `checkMarkdown` | `(markdown: string, file: string, renderer?: RendererPort) => Promise<Issue[]>` | Extracts, lints and optionally renders every diagram. Rejects with `renderer_failed_to_start` when the renderer cannot start. |
| `formatIssues` | `(issues: Issue[], format: 'text' or 'github') => string` | Formats issues as `file:line: CODE message` lines or as GitHub Actions `::error` commands. Each entry ends with LF. |
| `createFakeRenderer` | `(results: Record<string, string or Error>) => RendererPort` | Deterministic renderer for tests. |
| `createCommandRenderer` | `(command: string, args?: string[], opts?: { timeoutMs?: number }) => RendererPort` | Node-only. Writes the source to a temporary `.mmd` file and runs `command` with it, without a shell. Default timeout is 20000 ms. |
| `MermaidCheckError` | class with `code: 'renderer_failed_to_start' or 'input_too_large'` | Error of the library. Messages are cut to 200 characters. |

Types exported: `Diagram`, `DiagramType`, `Issue`, `RendererPort`, `RenderResult`, `MermaidCheckErrorCode`.

Limits: Markdown input is measured in UTF-16 code units and may be at most 5 MiB. A file may contain at most 1000 Mermaid diagrams. A diagram longer than 50000 characters yields `MMD007`. The CLI rejects files over 5 MiB, more than 10000 files, and directories nested deeper than 32 levels.

Options: `formatIssues` takes `'text'` or `'github'`. `createCommandRenderer` takes `timeoutMs`.

## CLI

`mermaid-check [PATH ...] [--format text|github] [--render-cmd PATH]` checks `.md` and `.mmd` files and walks directories in sorted order. Symbolic links are not followed. The CLI is exposed as `run(argv, io)` in `src/cli.ts`; the package declares no `bin` entry.

Exit codes: 0 no issues, 1 issues found, 2 usage error, I/O error or renderer start failure.

## Codes

| Code | Meaning |
|---|---|
| MMD001 | Unknown or missing diagram type |
| MMD002 | Flowchart direction not TB, TD, BT, RL, LR |
| MMD003 | Unbalanced `()`, `[]`, `{}` or double quotes |
| MMD004 | Unbalanced block keywords (subgraph/end, alt/loop/... end) |
| MMD005 | Lowercase `end` used as a flowchart node id |
| MMD006 | Empty diagram |
| MMD007 | Over 50000 characters |
| MMD008 | Renderer error (message cut to 200 characters) |

## Why not mermaid-cli

The official `@mermaid-js/mermaid-cli` renders each diagram in Chromium through Puppeteer and stops at the first error. This package needs no browser and reports all structural issues of a file in one run. It does not render by default, so it cannot detect every error that Mermaid's parser would report.

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Security

Threat model and limits: [docs/SECURITY.md](docs/SECURITY.md). The disclosure policy is in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Miguel Gomez
