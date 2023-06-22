const { Readable, Writable } = require('streamx')
const binding = require('./binding')

const DEFAULT_READ_BUFFER = 65536

process.on('exit', () => binding.reset())

exports.ReadStream = class TTYReadStream extends Readable {
  constructor (fd, opts = {}) {
    super()

    const {
      readBufferSize = DEFAULT_READ_BUFFER,
      allowHalfOpen = true
    } = opts

    this._pendingDestroy = null

    this._reading = false
    this._allowHalfOpen = allowHalfOpen

    this._buffer = Buffer.alloc(readBufferSize)

    this._handle = binding.init(fd, this._buffer, this,
      noop,
      noop,
      this._onread,
      this._onclose
    )
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

  _destroy (cb) {
    this._pendingDestroy = cb
    binding.close(this._handle)
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
}

exports.WriteStream = class TTYWriteStream extends Writable {
  constructor (fd, opts = {}) {
    super({ mapWritable })

    this._pendingWrite = null
    this._pendingFinal = null
    this._pendingDestroy = null

    this._handle = binding.init(fd, empty, this,
      this._onwrite,
      this._onfinal,
      noop,
      this._onclose
    )
  }

  get isTTY () {
    return true
  }

  _writev (datas, cb) {
    this._pendingWrite = cb
    binding.writev(this._handle, datas)
  }

  _final (cb) {
    this._pendingFinal = cb
    binding.end(this._handle)
  }

  _destroy (cb) {
    this._pendingDestroy = cb
    binding.close(this._handle)
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
}

exports.constants = {
  MODE_NORMAL: binding.MODE_NORMAL,
  MODE_RAW: binding.MODE_RAW,
  MODE_IO: binding.MODE_IO || 0
}

const empty = Buffer.alloc(0)

function noop () {}

function mapWritable (buf) {
  return typeof buf === 'string' ? Buffer.from(buf) : buf
}
