/**
 * Native mode and internal state flags used by `ReadStream`/`WriteStream`, such as `mode.NORMAL`
 * and `mode.RAW`.
 */
declare const constants: {
  mode: { NORMAL: number; RAW: number; IO: number }
  state: { READING: number; CLOSING: number }
}

export = constants
