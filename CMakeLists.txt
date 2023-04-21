cmake_minimum_required(VERSION 3.25)

project(pear_tty C)

include(pear)

add_pear_module(pear_tty)

target_sources(
  pear_tty
  PRIVATE
    binding.c
)
