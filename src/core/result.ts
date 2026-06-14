/**
 * A discriminated-union result type shared by every public method.
 *
 * Narrowing on `success` lets TypeScript infer that `data` is present on the
 * happy path and that `error` is present on the failure path:
 *
 * ```ts
 * const result = await service.search('Elden Ring')
 * if (result.success) {
 *   result.data // HowLongToBeatEntry[]
 * } else {
 *   result.error // string
 * }
 * ```
 */
export type Success<T> = { success: true; data: T }
export type Failure = { success: false; error: string }
export type Result<T> = Success<T> | Failure

export function ok<T>(data: T): Success<T> {
  return { success: true, data }
}

export function fail(error: string): Failure {
  return { success: false, error }
}
