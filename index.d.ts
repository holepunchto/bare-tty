import { Readable, ReadableOptions, Writable, WritableEvents, WritableOptions } from 'bare-stream'
import constants from './lib/constants'

interface ReadStream extends Readable {
  /** The stream's underlying file descriptor. */
  readonly fd: number
  /** Always `true`, identifying the stream as a TTY. */
  readonly isTTY: true

  /** Set the TTY mode directly, using one of the `constants.mode` values. Returns the stream. */
  setMode(mode: number): this
  /**
   * Enable or disable raw mode. In raw mode, input is delivered byte-by-byte without line buffering
   * or special key processing. Returns the stream.
   */
  setRawMode(mode: boolean): this
}

declare class ReadStream extends Readable {
  /** Create a `ReadStream` for the TTY file descriptor `fd`. */
  constructor(fd: number, opts?: ReadableOptions)
}

interface WriteStreamEvents extends WritableEvents {
  resize: []
}

interface WriteStream<M extends WriteStreamEvents = WriteStreamEvents> extends Writable<M> {
  /** The stream's underlying file descriptor. */
  readonly fd: number
  /** Always `true`, identifying the stream as a TTY. */
  readonly isTTY: true
  /** The current number of columns in the TTY. */
  readonly columns: number
  /** The current number of rows in the TTY. */
  readonly rows: number

  /** Return the current TTY dimensions as `[width, height]`. */
  getWindowSize(): [width: number, height: number]
}

declare class WriteStream<M extends WriteStreamEvents = WriteStreamEvents> extends Writable<M> {
  /** Create a `WriteStream` for the TTY file descriptor `fd`. */
  constructor(fd: number, opts?: WritableOptions)
}

/**
 * Return whether `fd` refers to a TTY.
 * @param fd - The file descriptor to check.
 */
declare function isTTY(fd: number): boolean

export { ReadStream, WriteStream, isTTY, isTTY as isatty, constants }
