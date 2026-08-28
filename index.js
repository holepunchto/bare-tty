const { Readable, Writable } = require('bare-stream')
const Signal = require('bare-signals')
const binding = require('./binding')
const constants = require('./lib/constants')
const errors = require('./lib/errors')

const defaultReadBufferSize = 65536
const empty = Buffer.alloc(0)
const modes = new Set([constants.mode.NORMAL, constants.mode.RAW, constants.mode.IO])

exports.ReadStream = class TTYReadStream extends Readable {
  constructor(fd, opts = {}) {
    super(opts)

    const { readBufferSize = defaultReadBufferSize } = opts

    validateFd(fd)
    validateInteger(readBufferSize, 'Read buffer size', 1, 0x7fffffff)

    this._fd = fd
    this._state = 0
    this._buffer = Buffer.alloc(readBufferSize)

    this._pendingDestroy = null

    this._handle = binding.init(fd, this._buffer, this, noop, this._onread, this._onclose, false)
  }

  get fd() {
    return this._fd
  }

  get isTTY() {
    return true
  }

  setMode(mode) {
    validateMode(mode)

    this._alive()

    binding.setMode(this._handle, mode)

    return this
  }

  setRawMode(enabled) {
    return this.setMode(enabled ? constants.mode.RAW : constants.mode.NORMAL)
  }

  _alive() {
    if (this._state & constants.state.CLOSING) {
      throw errors.STREAM_IS_CLOSED('Stream is closed')
    }
  }

  _read() {
    if ((this._state & constants.state.READING) === 0) {
      this._state |= constants.state.READING

      binding.resume(this._handle)
    }
  }

  _predestroy() {
    this._close()
  }

  _destroy(err, cb) {
    if (this._state & constants.state.CLOSED) return cb(err)

    this._pendingDestroy = cb

    this._close()
  }

  _close() {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING

    binding.close(this._handle)
  }

  _continueDestroy() {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onread(err, read) {
    if (err) {
      this.destroy(err)
      return
    }

    if (read === 0) {
      this.push(null)
      return
    }

    // Unpooled, as a read too small to be given a buffer of its own would
    // otherwise pin the whole pool it came from for as long as its consumer
    // holds on to it.
    const copy = Buffer.allocUnsafeSlow(read)
    copy.set(this._buffer.subarray(0, read))

    if (this.push(copy) === false && this.destroying === false) {
      this._state &= ~constants.state.READING

      binding.pause(this._handle)
    }
  }

  _onclose() {
    this._state |= constants.state.CLOSED

    this._continueDestroy()
  }
}

exports.WriteStream = class TTYWriteStream extends Writable {
  constructor(fd, opts = {}) {
    super(opts)

    validateFd(fd)

    this._fd = fd
    this._state = 0
    this._size = null

    this._pendingWrite = null
    this._pendingWriteBatch = null
    this._pendingDestroy = null

    this._handle = binding.init(fd, empty, this, this._onwrite, noop, this._onclose, true)

    try {
      this._refreshSize()
    } catch (err) {
      this._close()

      throw err
    }

    if (TTYWriteStream._streams.size === 0) TTYWriteStream._resize.start()

    TTYWriteStream._streams.add(this)
  }

  get fd() {
    return this._fd
  }

  get isTTY() {
    return true
  }

  get columns() {
    return this._size[0]
  }

  get rows() {
    return this._size[1]
  }

  getWindowSize() {
    this._alive()

    return [this._size[0], this._size[1]]
  }

  _refreshSize() {
    const size = binding.getWindowSize(this._handle)

    const changed = this._size === null || size[0] !== this._size[0] || size[1] !== this._size[1]

    this._size = size

    return changed
  }

  _alive() {
    if (this._state & constants.state.CLOSING) {
      throw errors.STREAM_IS_CLOSED('Stream is closed')
    }
  }

  _writev(batch, cb) {
    this._pendingWrite = cb
    this._pendingWriteBatch = batch

    try {
      coerceBatch(batch)

      binding.writev(
        this._handle,
        batch.map(({ chunk }) => chunk)
      )
    } catch (err) {
      this._continueWrite(err)
    }
  }

  _predestroy() {
    this._close()
  }

  _destroy(err, cb) {
    if (this._state & constants.state.CLOSED) return cb(err)

    this._pendingDestroy = cb

    this._close()
  }

  _close() {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING

    binding.close(this._handle)

    TTYWriteStream._streams.delete(this)

    if (TTYWriteStream._streams.size === 0) TTYWriteStream._resize.stop()
  }

  _continueWrite(err) {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite
    this._pendingWrite = null
    this._pendingWriteBatch = null
    cb(err)
  }

  _continueDestroy() {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onwrite(err) {
    this._continueWrite(err)
  }

  _onclose() {
    this._state |= constants.state.CLOSED

    this._continueDestroy()
  }

  _onresize() {
    let changed

    try {
      changed = this._refreshSize()
    } catch (err) {
      this.emit('error', err)
      return
    }

    if (changed) this.emit('resize')
  }

  static _streams = new Set()

  static _resize = new Signal('SIGWINCH')
}

exports.constants = constants

exports.errors = errors

exports.isTTY = function isTTY(fd) {
  return isValidFd(fd) && binding.isTTY(fd)
}

exports.isatty = exports.isTTY // For Node.js compatibility

exports.WriteStream._resize
  .on('signal', () => {
    for (const stream of exports.WriteStream._streams) {
      stream._onresize()
    }
  })
  .unref()

function isValidFd(fd) {
  return typeof fd === 'number' && Number.isInteger(fd) && fd >= 0 && fd <= 0x7fffffff
}

function validateFd(fd) {
  if (typeof fd !== 'number') {
    throw errors.INVALID_FD(`File descriptor must be a number, got ${typeof fd}`)
  }

  if (!isValidFd(fd)) {
    throw errors.INVALID_FD(
      `File descriptor must be an integer between 0 and ${0x7fffffff}, got ${fd}`
    )
  }
}

function validateMode(mode) {
  if (typeof mode !== 'number') {
    throw errors.INVALID_ARGUMENT(`Mode must be a number, got ${typeof mode}`)
  }

  if (!modes.has(mode)) {
    throw errors.INVALID_ARGUMENT(`Mode must be one of ${[...modes].join(', ')}, got ${mode}`)
  }
}

function validateInteger(value, name, min, max) {
  if (typeof value !== 'number') {
    throw errors.INVALID_ARGUMENT(`${name} must be a number, got ${typeof value}`)
  }

  if (!Number.isInteger(value) || value < min || value > max) {
    throw errors.INVALID_ARGUMENT(
      `${name} must be an integer between ${min} and ${max}, got ${value}`
    )
  }
}

function coerceBatch(batch) {
  for (let i = 0; i < batch.length; i++) {
    const chunk = batch[i].chunk

    if (ArrayBuffer.isView(chunk) === false) {
      throw errors.INVALID_ARGUMENT(`Chunk must be a string or a view, got ${typeof chunk}`)
    }

    batch[i].chunk = Buffer.coerce(chunk)
  }
}

function noop() {}
