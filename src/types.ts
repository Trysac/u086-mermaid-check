/** Diagram types recognised by the linter (Mermaid 11 syntax docs). */
export type DiagramType =
  | "flowchart"
  | "sequenceDiagram"
  | "classDiagram"
  | "stateDiagram"
  | "stateDiagram-v2"
  | "erDiagram"
  | "gantt"
  | "pie"
  | "journey"
  | "gitGraph"
  | "mindmap"
  | "timeline"
  | "quadrantChart"
  | "requirementDiagram"
  | "sankey-beta"
  | "xychart-beta"
  | "block-beta"
  | "C4Context"
  | "C4Container"
  | "C4Component"
  | "C4Dynamic"
  | "C4Deployment";

/** A Mermaid diagram found in a file. */
export interface Diagram {
  readonly file: string;
  /** First content line, 1-based. */
  readonly startLine: number;
  /** Content lines joined by LF, without a final LF. */
  readonly source: string;
  readonly type: DiagramType | null;
}

/** A problem found in a diagram. `line` is absolute within the file. */
export interface Issue {
  readonly code: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/** Result of an external render attempt. The SVG is never stored by the library. */
export type RenderResult =
  | { readonly ok: true; readonly svg: string }
  | { readonly ok: false; readonly message: string };

/** Port to an external Mermaid renderer. */
export interface RendererPort {
  render(source: string): Promise<RenderResult>;
}
