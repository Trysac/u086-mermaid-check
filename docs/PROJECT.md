# Project record: mermaid-check

## Objective

Provide a browser-free linter that finds Mermaid diagrams in Markdown files and reports common structural errors (unknown type, invalid flowchart direction, unbalanced brackets, quotes and block keywords, lowercase `end` as a node id, empty or oversized diagrams) with file and line numbers, and optionally calls an external renderer for each diagram.

The intended users are maintainers of Markdown documentation who run checks in continuous integration.

## Scope

In scope:

- The public API documented in the README: `extractDiagrams`, `validateDiagram`, `checkMarkdown`, `formatIssues`, `createFakeRenderer`, `MermaidCheckError`, and `createCommandRenderer` from `@trysac/mermaid-check/node`.
- Detection of 23 Mermaid diagram types by their first keyword, as listed in `src/lint.ts`.
- Eight issue codes, MMD001 to MMD008.
- The command line `run(argv, io)` in `src/cli.ts`, with text and GitHub Actions output.

Out of scope:

- Guaranteeing that Mermaid's own parser accepts a diagram. The checks are heuristic.
- Rendering diagrams in the library. Rendering happens only through a caller-supplied or command renderer, and the SVG output is discarded.
- Full grammar validation of each diagram type, including node, edge and message syntax beyond the listed checks.
- A browser, Puppeteer or Chromium dependency.
- Editing, fixing or formatting Mermaid source.
- Checking diagrams in formats other than Markdown fences and standalone `.mmd` files.

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Measured values only. Leave "pending measurement" until a real figure is recorded; never estimate here.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 285119 / 180541 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 1.1682 | factory ledger |

## Factory run u086b (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | claude-sonnet-5-5 | yes | 2567 | 128000 | 4550 | 0 | 0.6517 |
| generation | claude-sonnet-5-5 | yes | 2567 | 31524 | 0 | 4550 | 0.1606 |
| fix-1 | claude-sonnet-5-5 | no | 8 | 783 | 19766 | 55472 | 0.0628 |
| fix-2 | claude-sonnet-5-5 | no | 10 | 1782 | 8082 | 72957 | 0.0453 |
| audit | claude-sonnet-5-5 | no | 10 | 6426 | 39355 | 76832 | 0.1704 |
| fix-3 | claude-sonnet-5-5 | no | 6 | 3410 | 12790 | 44363 | 0.0705 |
| docs | claude-haiku-5-5 | no | 25777 | 8616 | 0 | 0 | 0.0069 |

Total: $1.1682. Prices: Anthropic list prices.
