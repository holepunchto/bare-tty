const test = require('brittle')
const tty = require('.')

test('stdout', (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(1)

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})

test('stderr', (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(2)

  t.comment(stdout.getWindowSize())

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})
