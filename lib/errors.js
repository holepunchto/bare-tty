module.exports = class TTYError extends Error {
  constructor(msg, fn = TTYError, code = fn.name) {
    super(`${code}: ${msg}`)
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'TTYError'
  }

  static STREAM_IS_CLOSED(msg) {
    return new TTYError(msg, TTYError.STREAM_IS_CLOSED)
  }

  static INVALID_FD(msg) {
    return new TTYError(msg, TTYError.INVALID_FD)
  }

  static INVALID_ARGUMENT(msg) {
    return new TTYError(msg, TTYError.INVALID_ARGUMENT)
  }
}
