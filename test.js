const test = require('brittle')
const { spawn } = require('bare-subprocess')
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

test('isTTY returns false for an invalid file descriptor', (t) => {
  t.is(tty.isTTY('1'), false)
  t.is(tty.isTTY({}), false)
  t.is(tty.isTTY(-1), false)
  t.is(tty.isTTY(1.5), false)
  t.is(tty.isatty('1'), false)
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
  t.exception(() => stream.setMode(-1), /INVALID_ARGUMENT/)
  t.exception(() => stream.setMode(0xffffffff), /INVALID_ARGUMENT/)

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

test('write stream, non-terminal file descriptor', { skip: tty.isTTY(1) }, (t) => {
  // The handle is created before the window size can be queried, so a failure
  // here must not leave the handle behind.
  t.exception(() => new tty.WriteStream(1))
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

test('write stream, window size is not aliased', { skip: !tty.isTTY(1) }, async (t) => {
  const stream = new tty.WriteStream(1)

  const size = stream.getWindowSize()

  t.not(size, stream.getWindowSize(), 'a fresh array each call')

  size[0] = -1

  t.not(stream.columns, -1, 'the caller cannot write through to the cached size')

  stream.destroy()

  await new Promise((resolve) => stream.on('close', resolve))
})

test('write stream, ending reaches close', { skip: !tty.isTTY(1) }, (t) => {
  t.plan(1)

  const stream = new tty.WriteStream(1)

  // Ending and destroying take different routes to `_destroy()`, and both have
  // to wait for the handle to close before the stream settles.
  stream.on('close', () => t.pass('closed')).end()
})

test('read stream, a read that fills the buffer leaves the loop running', async (t) => {
  // A read stream may be opened on a pipe, so this needs no terminal and runs
  // everywhere. The child reads exactly one buffer's worth and then has to get
  // back to its timer: if the descriptor were blocking, libuv would follow the
  // full read with another one and stall the loop inside it.
  const readBufferSize = 64

  const child = spawn(
    Bare.argv[0],
    [
      '-e',
      `
      const tty = require(${JSON.stringify(require.resolve('.'))})

      const stdin = new tty.ReadStream(0, { readBufferSize: ${readBufferSize} })

      stdin.on('data', () => {})

      setTimeout(() => {
        stdin.destroy()

        Bare.exit(42)
      }, 500)
      `
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] }
  )

  // The child closes its end as it exits, so the pipe may break under us.
  child.stdin.on('error', () => {})

  // Fill the read buffer exactly, and leave the pipe open so no end-of-file
  // arrives to release a blocking read.
  child.stdin.write(Buffer.alloc(readBufferSize, 0x2e))

  const timer = setTimeout(() => child.kill(), 10000)

  const code = await new Promise((resolve) => child.on('exit', resolve))

  clearTimeout(timer)

  child.stdin.destroy()

  t.is(code, 42, 'the child reached its timer instead of stalling')
})
