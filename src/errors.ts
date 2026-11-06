/** Stable machine-readable error codes. */
export type MermaidCheckErrorCode = "renderer_failed_to_start" | "input_too_large";

/** Base error of the library. */
export class MermaidCheckError extends Error {
  readonly code: MermaidCheckErrorCode;

  constructor(code: MermaidCheckErrorCode, message: string) {
    super(message.slice(0, 200));
    this.name = "MermaidCheckError";
    this.code = code;
  }
}
