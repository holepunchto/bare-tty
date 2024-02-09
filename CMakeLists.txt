cmake_minimum_required(VERSION 3.25)

project(bare_tty C)

include(bare)

add_bare_module(bare_tty)

target_sources(
  ${bare_tty}
  PRIVATE
    binding.c
)
