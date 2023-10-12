const { Readable, Writable } = require('streamx')
const binding = require('./binding')

const DEFAULT_READ_BUFFER = 65536

exports.ReadStream = class TTYReadStream extends Readable {
  constructor (fd, opts = {}) {
    super()

    const {
      readBufferSize = DEFAULT_READ_BUFFER,
      allowHalfOpen = true
    } = opts

    this._pendingDestroy = null

    this._reading = false
    this._closing = false
    this._allowHalfOpen = allowHalfOpen

    this._buffer = Buffer.alloc(readBufferSize)

    this._handle = binding.init(fd, this._buffer, this,
      noop,
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

  _read (cb) {
    if (!this._reading) {
      this._reading = true
      binding.resume(this._handle)
    }
    cb(null)
  }

  _predestroy () {
    if (this._closing) return
    this._closing = true
    binding.close(this._handle)
    TTYReadStream._streams.delete(this)
  }

  _destroy (cb) {
    if (this._closing) return cb(null)
    this._closing = true
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
      this._reading = false
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

    this._pendingWrite = null
    this._pendingFinal = null
    this._pendingDestroy = null

    this._closing = false

    this._handle = binding.init(fd, empty, this,
      this._onwrite,
      this._onfinal,
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
    this._pendingWrite = cb
    binding.writev(this._handle, datas)
  }

  _final (cb) {
    this._pendingFinal = cb
    binding.end(this._handle)
  }

  _predestroy () {
    if (this._closing) return
    this._closing = true
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
  }

  _destroy (cb) {
    if (this._closing) return cb(null)
    this._closing = true
    this._pendingDestroy = cb
    binding.close(this._handle)
    TTYWriteStream._streams.delete(this)
  }

  _continueWrite (err) {
    if (this._pendingWrite === null) return
    const cb = this._pendingWrite
    this._pendingWrite = null
    cb(err)
  }

  _continueFinal (err) {
    if (this._pendingFinal === null) return
    const cb = this._pendingFinal
    this._pendingFinal = null
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
      this._reading = false
      binding.pause(this._handle)
    }
  }

  _onfinal (err) {
    this._continueFinal(err)
  }

  _onclose () {
    this._handle = null
    this._continueDestroy()
  }

  static _streams = new Set()
}

exports.constants = {
  MODE_NORMAL: binding.MODE_NORMAL,
  MODE_RAW: binding.MODE_RAW,
  MODE_IO: binding.MODE_IO || 0
}

process
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
