/* global Bare */
const { Readable, Writable } = require('bare-stream')
const binding = require('./binding')
const constants = require('./lib/constants')

const defaultReadBufferSize = 65536

exports.ReadStream = class TTYReadStream extends Readable {
  constructor (fd, opts = {}) {
    super()

    const {
      readBufferSize = defaultReadBufferSize,
      allowHalfOpen = true
    } = opts

    this._state = 0

    this._allowHalfOpen = allowHalfOpen

    this._pendingDestroy = null

    this._buffer = Buffer.alloc(readBufferSize)

    this._handle = binding.init(fd, this._buffer, this,
      noop,
      this._onread,
      this._onclose
    )

    TTYReadStream._streams.add(this)
  }

  get isTTY () {
    return true
  }

  setMode (mode) {
    binding.setMode(this._handle, mode)
  }

  setRawMode (mode) {
    this.setMode(mode ? constants.mode.RAW : constants.mode.NORMAL)
  }

  _read (cb) {
    if ((this._state & constants.state.READING) === 0) {
      this._state |= constants.state.READING
      binding.resume(this._handle)
    }

    cb(null)
  }

  _predestroy () {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING
    binding.close(this._handle)
    TTYReadStream._streams.delete(this)
  }

  _destroy (cb) {
    if (this._state & constants.state.CLOSING) return cb(null)
    this._state |= constants.state.CLOSING
    this._pendingDestroy = cb
    binding.close(this._handle)
    TTYReadStream._streams.delete(this)
  }

  _continueDestroy () {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onread (err, read) {
    if (err) {
      this.destroy(err)
      return
    }

    if (read === 0) {
      this.push(null)
      if (this._allowHalfOpen === false) this.end()
      return
    }

    const copy = Buffer.allocUnsafe(read)
    copy.set(this._buffer.subarray(0, read))

    if (this.push(copy) === false && this.destroying === false) {
      this._state &= ~constants.state.READING
      binding.pause(this._handle)
    }
  }

  _onclose () {
    this._handle = null
    this._continueDestroy()
  }

  static _streams = new Set()
}

exports.WriteStream = class TTYWriteStream extends Writable {
  constructor (fd, opts = {}) {
    super({ mapWritable })

    this._state = 0

    this._pendingWrite = null
    this._pendingDestroy = null

    this._handle = binding.init(fd, empty, this,
      this._onwrite,
      noop,
      this._onclose
    )

    TTYWriteStream._streams.add(this)
  }

  get isTTY () {
    return true
  }

  getWindowSize () {
    return binding.getWindowSize(this._handle)
  }

  _writev (datas, cb) {
    this._pendingWrite = [cb, datas]
    binding.writev(this._handle, datas)
  }

  _predestroy () {
    if (this._state & constants.state.CLOSING) return
    this._state |= constants.state.CLOSING
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
  }

  _destroy (cb) {
    if (this._state & constants.state.CLOSING) return cb(null)
    this._state |= constants.state.CLOSING
    this._pendingDestroy = cb
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
  }

  _continueWrite (err) {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite[0]
    this._pendingWrite = null
    cb(err)
  }

  _continueDestroy () {
    if (this._pendingDestroy === null) return
    const cb = this._pendingDestroy
    this._pendingDestroy = null
    cb(null)
  }

  _onwrite (err) {
    this._continueWrite(err)
  }

  _onclose () {
    this._handle = null
    this._continueDestroy()
  }

  static _streams = new Set()
}

exports.constants = constants

exports.isTTY = binding.isTTY

exports.isatty = exports.isTTY // For Node.js compatibility

Bare
  .on('exit', () => {
    for (const stream of exports.ReadStream._streams) {
      stream.destroy()
    }

    for (const stream of exports.WriteStream._streams) {
      stream.destroy()
    }
  })

const empty = Buffer.alloc(0)

function noop () {}

function mapWritable (buf) {
  return typeof buf === 'string' ? Buffer.from(buf) : buf
}
