# bare-tty

Native TTY streams for JavaScript.

```
npm i bare-tty
```

## Usage

```js
const tty = require('bare-tty')

const stdout = new tty.WriteStream(1)

stdout.write('Hello world!\n')
```

## License

Apache-2.0

## API

See the [full API reference](https://docs.pears.com/reference/bare/modules/bare-tty).
