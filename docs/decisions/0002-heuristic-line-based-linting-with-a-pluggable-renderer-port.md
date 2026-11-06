# Heuristic, line-based linting with a pluggable renderer port

Status: accepted (generated, pending human review)

## Context

Mermaid diagrams break silently on GitHub, and the official mermaid-cli needs Chromium and stops at the first error. CI needs a fast, browser-free check that reports all structural mistakes with absolute line numbers.

## Decision

Implement a pure, dependency-free core that extracts fenced diagrams (CommonMark rules, including list-item content columns) and runs single-pass, line-based checks (MMD001-MMD007) without backtracking regexes. An optional RendererPort (MMD008) lets callers plug in an external renderer; the core imports nothing from node: and only src/node.ts and src/cli.ts touch the filesystem and child processes, using execFile without a shell. The checks are heuristics and do not guarantee that Mermaid's parser accepts a diagram.

## Consequences

Fast and browser-free, reports all issues at once, and is deterministic to test through the fake renderer. False positives and negatives are possible on exotic syntax, and the type list is pinned to Mermaid 11 documentation and must be updated by hand. Markdown size is measured in UTF-16 code units to keep the core free of Node APIs.
