import { Readable, ReadableOptions, Writable, WritableEvents, WritableOptions } from 'bare-stream'
import constants from './lib/constants'
import TTYError from './lib/errors'

interface ReadStreamOptions extends ReadableOptions {
  readBufferSize?: number
}

interface ReadStream extends Readable {
  readonly fd: number
  readonly isTTY: true

  setMode(mode: number): this
  setRawMode(mode: boolean): this
}

declare class ReadStream extends Readable {
  constructor(fd: number, opts?: ReadStreamOptions)
}

interface WriteStreamEvents extends WritableEvents {
  resize: []
}

interface WriteStream<M extends WriteStreamEvents = WriteStreamEvents> extends Writable<M> {
  readonly fd: number
  readonly isTTY: true
  readonly columns: number
  readonly rows: number

  getWindowSize(): [width: number, height: number]
}

declare class WriteStream<M extends WriteStreamEvents = WriteStreamEvents> extends Writable<M> {
  constructor(fd: number, opts?: WritableOptions)
}

declare function isTTY(fd: number): boolean

export {
  type ReadStreamOptions,
  ReadStream,
  WriteStream,
  isTTY,
  isTTY as isatty,
  constants,
  type TTYError,
  TTYError as errors
}
