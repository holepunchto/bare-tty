#include <assert.h>
#include <js.h>
#include <pear.h>
#include <stdlib.h>
#include <uv.h>

typedef struct {
  uv_tty_t tty;
  uv_buf_t read_buf;
  uv_shutdown_t end;
  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_write;
  js_ref_t *on_end;
  js_ref_t *on_read;
  js_ref_t *on_close;
} pear_tty_t;

static void
on_write (uv_write_t *req, int status) {
  int err;

  pear_tty_t *self = (pear_tty_t *) req->data;

  js_env_t *env = self->env;

  js_value_t *ctx;
  err = js_get_reference_value(env, self->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, self->on_write, &callback);
  assert(err == 0);

  js_value_t *argv[1];
  err = js_create_int32(env, status, &argv[0]);
  assert(err == 0);

  js_call_function(env, ctx, callback, 1, argv, NULL);
}

static void
on_shutdown (uv_shutdown_t *req, int status) {
  int err;

  pear_tty_t *self = (pear_tty_t *) req->data;

  js_env_t *env = self->env;

  js_value_t *ctx;
  err = js_get_reference_value(env, self->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, self->on_end, &callback);
  assert(err == 0);

  js_value_t *argv[1];
  err = js_create_int32(env, status, &argv[0]);
  assert(err == 0);

  js_call_function(env, ctx, callback, 1, argv, NULL);
}

static void
on_read (uv_stream_t *stream, ssize_t nread, const uv_buf_t *buf) {
  if (nread == UV_EOF) nread = 0;
  else if (nread == 0) return;

  int err;

  pear_tty_t *self = (pear_tty_t *) stream;

  js_env_t *env = self->env;

  js_value_t *ctx;
  err = js_get_reference_value(env, self->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, self->on_read, &callback);
  assert(err == 0);

  js_value_t *argv[1];
  err = js_create_int32(env, nread, &argv[0]);
  assert(err == 0);

  js_call_function(env, ctx, callback, 1, argv, NULL);
}

static void
on_close (uv_handle_t *handle) {
  int err;

  pear_tty_t *self = (pear_tty_t *) handle;

  js_env_t *env = self->env;

  js_value_t *ctx;
  err = js_get_reference_value(env, self->ctx, &ctx);
  assert(err == 0);

  js_value_t *callback;
  err = js_get_reference_value(env, self->on_close, &callback);
  assert(err == 0);

  js_call_function(env, ctx, callback, 0, NULL, NULL);

  err = js_delete_reference(env, self->on_write);
  assert(err == 0);

  err = js_delete_reference(env, self->on_end);
  assert(err == 0);

  err = js_delete_reference(env, self->on_read);
  assert(err == 0);

  err = js_delete_reference(env, self->on_close);
  assert(err == 0);

  err = js_delete_reference(env, self->ctx);
  assert(err == 0);
}

static void
on_alloc (uv_handle_t *handle, size_t suggested_size, uv_buf_t *buf) {
  pear_tty_t *self = (pear_tty_t *) handle;
  *buf = self->read_buf;
}

static js_value_t *
pear_tty_init (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 8;
  js_value_t *argv[8];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 8);

  uv_loop_t *loop;
  js_get_env_loop(env, &loop);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  size_t read_buf_len;
  char *read_buf;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &read_buf, &read_buf_len, NULL, NULL);
  assert(err == 0);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[2], &fd);
  assert(err == 0);

  err = uv_tty_init(loop, &self->tty, fd, 1);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  self->env = env;

  self->read_buf = uv_buf_init(read_buf, read_buf_len);

  err = js_create_reference(env, argv[3], 1, &self->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &self->on_write);
  assert(err == 0);

  err = js_create_reference(env, argv[5], 1, &self->on_end);
  assert(err == 0);

  err = js_create_reference(env, argv[6], 1, &self->on_read);
  assert(err == 0);

  err = js_create_reference(env, argv[7], 1, &self->on_close);
  assert(err == 0);

  return NULL;
}

static js_value_t *
pear_tty_writev (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  uv_write_t *req;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &req, NULL, NULL, NULL);
  assert(err == 0);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  js_value_t *arr = argv[2];
  js_value_t *item;

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  for (uint32_t i = 0; i < bufs_len; i++) {
    err = js_get_element(env, arr, i, &item);
    assert(err == 0);

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, &buf->len, NULL, NULL);
    assert(err == 0);
  }

  req->data = self;

  err = uv_write(req, (uv_stream_t *) &self->tty, bufs, bufs_len, on_write);

  free(bufs);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
pear_tty_end (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  uv_shutdown_t *req = &self->end;

  req->data = self;

  err = uv_shutdown(req, (uv_stream_t *) self, on_shutdown);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
pear_tty_resume (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  err = uv_read_start((uv_stream_t *) &self->tty, on_alloc, on_read);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
pear_tty_pause (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  err = uv_read_stop((uv_stream_t *) &self->tty);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
pear_tty_close (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  uv_close((uv_handle_t *) &self->tty, on_close);

  return NULL;
}

static js_value_t *
pear_tty_reset (js_env_t *env, js_callback_info_t *info) {
  int err;

  err = uv_tty_reset_mode();
  assert(err == 0);

  return NULL;
}

static js_value_t *
pear_tty_set_mode (js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  pear_tty_t *self;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &self, NULL, NULL, NULL);
  assert(err == 0);

  uint32_t mode;
  err = js_get_value_uint32(env, argv[1], &mode);
  assert(err == 0);

  err = uv_tty_set_mode(&self->tty, mode);

  if (err < 0) {
    js_throw_error(env, uv_err_name(err), uv_strerror(err));
    return NULL;
  }

  return NULL;
}

static js_value_t *
init (js_env_t *env, js_value_t *exports) {
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(pear_tty_t), &val);
    js_set_named_property(env, exports, "sizeofTTY", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, sizeof(uv_write_t), &val);
    js_set_named_property(env, exports, "sizeofWrite", val);
  }
  {
    js_value_t *fn;
    js_create_function(env, "init", -1, pear_tty_init, NULL, &fn);
    js_set_named_property(env, exports, "init", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "writev", -1, pear_tty_writev, NULL, &fn);
    js_set_named_property(env, exports, "writev", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "end", -1, pear_tty_end, NULL, &fn);
    js_set_named_property(env, exports, "end", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "resume", -1, pear_tty_resume, NULL, &fn);
    js_set_named_property(env, exports, "resume", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "pause", -1, pear_tty_pause, NULL, &fn);
    js_set_named_property(env, exports, "pause", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "close", -1, pear_tty_close, NULL, &fn);
    js_set_named_property(env, exports, "close", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "reset", -1, pear_tty_reset, NULL, &fn);
    js_set_named_property(env, exports, "reset", fn);
  }
  {
    js_value_t *fn;
    js_create_function(env, "setMode", -1, pear_tty_set_mode, NULL, &fn);
    js_set_named_property(env, exports, "setMode", fn);
  }
  {
    js_value_t *val;
    js_create_uint32(env, UV_TTY_MODE_NORMAL, &val);
    js_set_named_property(env, exports, "MODE_NORMAL", val);
  }
  {
    js_value_t *val;
    js_create_uint32(env, UV_TTY_MODE_RAW, &val);
    js_set_named_property(env, exports, "MODE_RAW", val);
  }
#ifndef _WIN32
  {
    js_value_t *val;
    js_create_uint32(env, UV_TTY_MODE_IO, &val);
    js_set_named_property(env, exports, "MODE_IO", val);
  }
#endif

  return exports;
}

PEAR_MODULE(pear_tty, init)
