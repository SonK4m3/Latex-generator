export type McpOperationErrorCode =
  | "invalid_input"
  | "not_found"
  | "idempotency_conflict"
  | "quota_exceeded"
  | "not_available"
  | "source_too_large"
  | "version_conflict";

export class McpOperationError extends Error {
  constructor(readonly code: McpOperationErrorCode, message: string) {
    super(message);
    this.name = "McpOperationError";
  }
}

/** Do not expose database error messages, SQL, or raw tool inputs to the caller. */
export function mapMcpStoreError(error: { code: string; message?: string }): never {
  switch (error.code) {
    case "22P02":
    case "22023":
    case "23514":
      throw new McpOperationError("invalid_input", "The request data is invalid.");
    case "P0001":
      if (error.message === "quota_exceeded") {
        throw new McpOperationError("quota_exceeded", "Your compile quota is exhausted. Try again later.");
      }
      if (error.message === "idempotency_conflict") {
        throw new McpOperationError("idempotency_conflict", "This idempotency key is in use with different input.");
      }
      throw new McpOperationError("not_available", "The document service is temporarily unavailable.");
    case "PT409":
      throw new McpOperationError("idempotency_conflict", "This idempotency key is in use with different input.");
    case "23505":
      throw new McpOperationError("not_available", "The document service is temporarily unavailable.");
    case "PT429":
      throw new McpOperationError("quota_exceeded", "Your compile quota is exhausted. Try again later.");
    case "P0002":
    case "PT404":
      throw new McpOperationError("not_found", "The requested item is unavailable.");
    default:
      throw new McpOperationError("not_available", "The document service is temporarily unavailable.");
  }
}
