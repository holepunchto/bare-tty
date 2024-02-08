const test = require('brittle')
const tty = require('.')

test('stdout', { skip: !tty.isTTY(1) }, (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(1)

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})

test('stderr', { skip: !tty.isTTY(2) }, (t) => {
  t.plan(1)

  const stdout = new tty.WriteStream(2)

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})
