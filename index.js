const { Duplex } = require('streamx')
const binding = require('./binding')

const DEFAULT_READ_BUFFER = 65536

process.on('exit', () => binding.reset())

module.exports = exports = class TTY extends Duplex {
  constructor (fd, { readBufferSize = DEFAULT_READ_BUFFER, allowHalfOpen = true } = {}) {
    super({ mapWritable })

    const slab = Buffer.alloc(binding.sizeofTTY + binding.sizeofWrite + readBufferSize)

    this._handle = slab.subarray(0, binding.sizeofTTY)
    this._req = slab.subarray(binding.sizeofTTY, binding.sizeofTTY + binding.sizeofWrite)
    this._buffer = slab.subarray(binding.sizeofTTY + binding.sizeofWrite)

    this._writeCallback = null
    this._finalCallback = null
    this._destroyCallback = null

    this._allowHalfOpen = allowHalfOpen

    binding.init(this._handle, this._buffer, fd, this,
      this._onwrite,
      this._onfinal,
      this._onread,
      this._onclose
    )
  }

  _open (cb) {
    binding.resume(this._handle)
    cb(null)
  }

  _writev (datas, cb) {
    this._writeCallback = cb
    binding.writev(this._req, this._handle, datas)
  }

  _final (cb) {
    this._finalCallback = cb
    binding.end(this._handle)
  }

  _destroy (cb) {
    this._destroyCallback = cb
    binding.close(this._handle)
  }

  _continueWrite (err) {
    if (this._writeCallback === null) return
    const cb = this._writeCallback
    this._writeCallback = null
    cb(err)
  }

  _continueFinal (err) {
    if (this._finalCallback === null) return
    const cb = this._finalCallback
    this._finalCallback = null
    cb(err)
  }

  _continueDestroy () {
    if (this._destroyCallback === null) return
    const cb = this._destroyCallback
    this._destroyCallback = null
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

    this.push(copy)
  }

  _onfinal (err) {
    this._continueFinal(err)
  }

  _onclose () {
    this._handle = null
    this._continueDestroy()
  }

  setMode (mode) {
    binding.setMode(this._handle, mode)
  }
}

exports.constants = {
  MODE_NORMAL: binding.MODE_NORMAL,
  MODE_RAW: binding.MODE_RAW,
  MODE_IO: binding.MODE_IO || 0
}

function mapWritable (buf) {
  return typeof buf === 'string' ? Buffer.from(buf) : buf
}
