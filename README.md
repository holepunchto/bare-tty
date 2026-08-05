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

<!-- bare-refgen:api start -->

## API

### ReadStream

#### `new ReadStream(fd: number, opts?: ReadableOptions)`

Create a `ReadStream` for the TTY file descriptor `fd`.

**Parameters**

| Parameter | Type              | Default | Description                                                                  |
| --------- | ----------------- | ------- | ---------------------------------------------------------------------------- |
| `fd`      | `number`          | —       | The file descriptor of the TTY.                                              |
| `opts?`   | `ReadableOptions` | —       | Options; `readBufferSize` defaults to `65536` and `allowHalfOpen` to `true`. |

#### `ReadStream.fd: number`

The stream's underlying file descriptor.

#### `ReadStream.isTTY: true`

Always `true`, identifying the stream as a TTY.

#### `setMode(mode: number): this`

Set the TTY mode directly, using one of the `constants.mode` values. Returns the stream.

**Parameters**

| Parameter | Type     | Default | Description                                              |
| --------- | -------- | ------- | -------------------------------------------------------- |
| `mode`    | `number` | —       | The TTY mode to set, one of the `constants.mode` values. |

#### `setRawMode(mode: boolean): this`

Enable or disable raw mode. In raw mode, input is delivered byte-by-byte without line buffering or special key processing. Returns the stream.

**Parameters**

| Parameter | Type      | Default | Description                                                  |
| --------- | --------- | ------- | ------------------------------------------------------------ |
| `mode`    | `boolean` | —       | `true` to enable raw mode, `false` to return to normal mode. |

### WriteStream

#### `new WriteStream(fd: number, opts?: WritableOptions)`

Create a `WriteStream` for the TTY file descriptor `fd`.

**Parameters**

| Parameter | Type              | Default | Description                     |
| --------- | ----------------- | ------- | ------------------------------- |
| `fd`      | `number`          | —       | The file descriptor of the TTY. |
| `opts?`   | `WritableOptions` | —       | —                               |

#### `columns: number`

The current number of columns in the TTY.

#### `WriteStream.fd: number`

The stream's underlying file descriptor.

#### `getWindowSize(): [width: number, height: number]`

Return the current TTY dimensions as `[width, height]`.

#### `WriteStream.isTTY: true`

Always `true`, identifying the stream as a TTY.

#### `rows: number`

The current number of rows in the TTY.

### Functions

#### `isTTY(fd: number): boolean`

Return whether `fd` refers to a TTY.

**Parameters**

| Parameter | Type     | Default | Description                   |
| --------- | -------- | ------- | ----------------------------- |
| `fd`      | `number` | —       | The file descriptor to check. |

### Constants and variables

#### `constants`

```ts
constants: {
  mode: {
    NORMAL: number
    RAW: number
    IO: number
  }
  state: {
    READING: number
    CLOSING: number
  }
}
```

Native mode and internal state flags used by `ReadStream`/`WriteStream`, such as `mode.NORMAL` and `mode.RAW`.
<!-- bare-refgen:api end -->
