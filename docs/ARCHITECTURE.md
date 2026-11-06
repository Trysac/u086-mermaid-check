# Architecture

## Overview

`@trysac/mermaid-check` is a small TypeScript library published to npm as ES modules with type declarations. It finds fenced Mermaid diagrams in Markdown and lints them for common structural mistakes without a browser. An optional external renderer can be called for each diagram.

## Modules

| Module | Responsibility |
|---|---|
| `src/index.ts` | Public entry point. Extracts diagrams from Markdown, formats issues, provides the fake renderer and re-exports the value and type API. |
| `src/lint.ts` | Type detection (`detectType`), per-diagram validation (`validateDiagram`, codes MMD001 to MMD005), render step (`checkDiagram`) and issue sorting. |
| `src/types.ts` | Shared types: `Diagram`, `DiagramType`, `Issue`, `RenderResult`, `RendererPort`. |
| `src/errors.ts` | `MermaidCheckError` and its codes. |
| `src/node.ts` | Node-only `createCommandRenderer`, which runs an external command on a temporary file. |
| `src/cli.ts` | Command line `run(argv, io)` that returns an exit code. |

The modules `src/lint.ts`, `src/types.ts` and `src/errors.ts` are internal. Consumers import only what `src/index.ts` and `src/node.ts` export.

## Boundaries

- The core (`src/index.ts`, `src/lint.ts`, `src/types.ts`, `src/errors.ts`) imports nothing from `node:`.
- Only `src/node.ts` and `src/cli.ts` use Node APIs (file system, child processes).
- No runtime dependencies. Any addition must be justified in [STACK.md](STACK.md).
- Errors are reported as issues when they concern a diagram. Limits and renderer start failures are thrown as `MermaidCheckError`.

## Data flow

1. `extractDiagrams` splits the Markdown into lines and finds CommonMark fences whose info string starts with `mermaid`.
2. `validateDiagram` runs the structural checks on each diagram.
3. `checkDiagram` optionally calls the `RendererPort` when the diagram has no blocking issue (MMD001, MMD006, MMD007).
4. `sortIssues` orders the result by file, line and code. `formatIssues` renders it as text or GitHub Actions commands.

## Build and distribution

`npm run build` compiles `src/` to `dist/` with `tsconfig.build.json`. Only `dist/` is published (`files` in `package.json`).

## Decisions

Architectural decisions are recorded in [decisions/](decisions/), starting with [0001](decisions/0001-record-architecture-decisions.md).
