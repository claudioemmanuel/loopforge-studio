/**
 * Result<T, E> - Type-safe error handling for Clean Architecture use cases.
 *
 * Forces explicit handling of success and failure paths.
 * Use cases return Result instead of throwing exceptions.
 */
export class Result<T, E extends Error> {
  private constructor(
    private readonly _value?: T,
    private readonly _error?: E,
    private readonly _isSuccess: boolean = true,
  ) {}

  static ok<T, E extends Error>(value: T): Result<T, E> {
    return new Result<T, E>(value, undefined, true);
  }

  static fail<T, E extends Error>(error: E): Result<T, E> {
    return new Result<T, E>(undefined, error, false);
  }

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error("Cannot get value from failed Result");
    }
    return this._value as T;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error("Cannot get error from successful Result");
    }
    return this._error as E;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this._isSuccess
      ? Result.ok(fn(this.value))
      : Result.fail(this.error);
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return this._isSuccess ? fn(this.value) : Result.fail(this.error);
  }

  mapError<F extends Error>(fn: (error: E) => F): Result<T, F> {
    return this._isSuccess
      ? Result.ok(this.value)
      : Result.fail(fn(this.error));
  }

  unwrapOr(defaultValue: T): T {
    return this._isSuccess ? this.value : defaultValue;
  }
}
