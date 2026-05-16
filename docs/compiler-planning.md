# Compiler Planning

This repository models a compiler-side execution plan generator that emits:

- execution regions
- promotion windows
- DMA schedules
- replay checkpoints
- orchestration IR steps

## Planning modes

- static
- adaptive
- feedback-driven

These modes are intended to illustrate how runtime orchestration may benefit from compile-time structure without requiring a fully static schedule.
