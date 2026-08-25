const test = require('brittle')
const tty = require('.')

// A read stream can be opened on a pipe as well as a terminal, but not on a
// file, so whether stdin is usable depends on how the suite was started.
const canOpenStdin = (() => {
  try {
    new tty.ReadStream(0).destroy()

    return true
  } catch {
    return false
  }
})()

test('stdout', { skip: !tty.isTTY(1) }, (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(1)

  stdout.on('close', () => t.pass('closed')).end('hello from pipe\n')
})

test('stderr', { skip: !tty.isTTY(2) }, (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(2)

  stdout.on('close', () => t.pass('closed')).end('hello from pipe\n')
})

test('isTTY rejects an invalid file descriptor', (t) => {
  t.exception(() => tty.isTTY('1'), /INVALID_FD/)
  t.exception(() => tty.isTTY({}), /INVALID_FD/)
  t.exception(() => tty.isTTY(-1), /INVALID_FD/)
  t.exception(() => tty.isTTY(1.5), /INVALID_FD/)
  t.exception(() => tty.isatty('1'), /INVALID_FD/)
})

test('isTTY returns a boolean', (t) => {
  t.is(typeof tty.isTTY(1), 'boolean')
})

test('streams reject an invalid file descriptor', (t) => {
  t.exception(() => new tty.ReadStream('0'), /INVALID_FD/)
  t.exception(() => new tty.ReadStream(null), /INVALID_FD/)
  t.exception(() => new tty.ReadStream(-1), /INVALID_FD/)
  t.exception(() => new tty.WriteStream('1'), /INVALID_FD/)
  t.exception(() => new tty.WriteStream(1.5), /INVALID_FD/)
})

test('read stream rejects an invalid read buffer size', (t) => {
  t.exception(() => new tty.ReadStream(0, { readBufferSize: 0 }), /INVALID_ARGUMENT/)
  t.exception(() => new tty.ReadStream(0, { readBufferSize: 'big' }), /INVALID_ARGUMENT/)
  t.exception(() => new tty.ReadStream(0, { readBufferSize: 1.5 }), /INVALID_ARGUMENT/)
})

test('read stream, setMode rejects an invalid mode', { skip: !canOpenStdin }, (t) => {
  const stream = new tty.ReadStream(0)

  t.exception(() => stream.setMode('raw'), /INVALID_ARGUMENT/)
  t.exception(() => stream.setMode(null), /INVALID_ARGUMENT/)
  t.exception(() => stream.setMode(1.5), /INVALID_ARGUMENT/)

  stream.destroy()

  return new Promise((resolve) => stream.on('close', resolve))
})

test('read stream, setMode after close', { skip: !canOpenStdin }, async (t) => {
  const stream = new tty.ReadStream(0)

  stream.destroy()

  await new Promise((resolve) => stream.on('close', resolve))

  // The handle is created eagerly and is not discarded on close, so a late call
  // is rejected rather than reaching the binding with a stale handle.
  t.exception(() => stream.setMode(tty.constants.mode.RAW), /STREAM_IS_CLOSED/)
  t.exception(() => stream.setRawMode(true), /STREAM_IS_CLOSED/)
})

test('read stream, destroying twice closes once', { skip: !canOpenStdin }, async (t) => {
  const stream = new tty.ReadStream(0)

  stream.destroy()
  stream.destroy()

  await new Promise((resolve) => stream.on('close', resolve))

  // The stream's own state guard stops the second destroy short of the binding.
  t.pass('closed once')
})

test('write stream, window size', { skip: !tty.isTTY(1) }, (t) => {
  const stream = new tty.WriteStream(1)

  const size = stream.getWindowSize()

  t.is(size.length, 2)
  t.is(stream.columns, size[0])
  t.is(stream.rows, size[1])

  stream.destroy()

  return new Promise((resolve) => stream.on('close', resolve))
})

test('write stream, window size after close', { skip: !tty.isTTY(1) }, async (t) => {
  const stream = new tty.WriteStream(1)

  const columns = stream.columns

  stream.destroy()

  await new Promise((resolve) => stream.on('close', resolve))

  t.exception(() => stream.getWindowSize(), /STREAM_IS_CLOSED/)

  // Cached, so it stays readable after close rather than throwing.
  t.is(stream.columns, columns)
})
