const test = require('brittle')
const TtyPipe = require('.')

test('stdout', (t) => {
  t.plan(1)

  const stdout = new TtyPipe(1)

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})

test('stderr', (t) => {
  t.plan(1)

  const stdout = new TtyPipe(2)

  stdout
    .on('close', () => t.pass('closed'))
    .end('hello from pipe\n')
})
