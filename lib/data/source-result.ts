import type { SourceResult } from "@/lib/types/company";

const now = () => new Date().toISOString();

export function sourceSuccess<T>(data: T): SourceResult<T> {
  return { state: "success", data, updatedAt: now() };
}

export function sourceEmpty<T>(message: string): SourceResult<T> {
  return { state: "empty", data: null, message, updatedAt: now() };
}

export function sourceUnavailable<T>(
  message: string,
  rateLimited = false,
): SourceResult<T> {
  return {
    state: rateLimited ? "rate_limited" : "unavailable",
    data: null,
    message,
    updatedAt: now(),
  };
}
