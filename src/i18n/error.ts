/** Stable diagnostic identity; English messages preserve legacy parser/API compatibility. */
export type DiagnosticCode =
  keyof typeof import("../../messages/en-US/diagnostics.json");
export type ErrorParams = Record<string, string | number>;
export type ErrorDescriptor = {
  code?: string;
  params?: ErrorParams;
  message: string;
};
export class AppError extends Error {
  constructor(
    public readonly code: DiagnosticCode,
    message: string,
    public readonly params?: ErrorParams,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export function describeError(value: unknown): ErrorDescriptor {
  if (typeof value === "string") return { message: value };
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    if (source.name === "ZodError")
      return { code: "invalidInput", message: "Invalid Top Gear input" };
    if (source.name === "SyntaxError")
      return { code: "invalidJson", message: "Invalid JSON" };
    const params =
      source.params && typeof source.params === "object"
        ? (Object.fromEntries(
            Object.entries(source.params).filter(
              ([, item]) =>
                typeof item === "string" ||
                (typeof item === "number" && Number.isFinite(item)),
            ),
          ) as ErrorParams)
        : undefined;
    return {
      ...(typeof source.code === "string" ? { code: source.code } : {}),
      ...(params ? { params } : {}),
      message:
        typeof source.message === "string"
          ? source.message
          : typeof source.error === "string"
            ? source.error
            : "",
    };
  }
  return { message: "" };
}
