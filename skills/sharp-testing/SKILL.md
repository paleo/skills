---
name: sharp-testing
description: Rules for writing automated tests that detect real mistakes, and for leaving out tests that cannot. Read before implementing a feature, fixing a bug, refactoring, or writing and changing tests.
license: CC0 1.0
metadata:
  author: Paleo
  version: "0.2.0"
  repository: https://github.com/paleo/skills
---

# Sharp Testing

A test earns its place by detecting a plausible mistake that no other check detects. Writing a test and keeping it are separate decisions. The default for a change is no new test.

## When a test is justified

A permanent test answers: which plausible mistake would it catch, which existing check would miss it, and why would the mistake matter. Name the incorrect behavior and its consequence; that the code could change is no answer. Inspect the relevant tests first, and extend one when it can cover the missing case.

New functions, branches, files, and uncovered lines call for no test by themselves. Coverage locates gaps; it never justifies a test. Getters, pass-through code, constructors, type-level guarantees, and framework behavior need no test. A change with no new test is valid when existing protection suffices.

## Expected values

Expected values come from the requirement: the domain rule, the specification, the compatibility obligation. The implementation shows what the code does, never what it should do.

An expectation generated with the code under test, or copied from its output into a snapshot, fails only when the code changes. That is a change detector, not a guard. Validate a captured output against the requirement before adopting it as a fixture or a snapshot.

## What to assert

Assert the outcome a caller sees: the return value, the persisted state, the emitted event, the response. Leave unconstrained what is incidental: wording, extra fields, helper calls, internal ordering. A behavior-preserving refactor leaves assertions intact.

Exact text, bytes, or ordering are asserted only when that representation is the contract: an error code a client parses, a CLI flag, a serialized key, an API path, a migration name. Snapshots follow the same standard.

An interaction is asserted only when the interaction is the contract, such as sending a notification exactly once.

A rejection test exercises the intended guard. Failing earlier for an unrelated reason proves nothing.

One behavior per test, named after the behavior.

## Real code, substituted boundaries

The production logic responsible for the claimed behavior runs for real. Substitute only what lies outside it: network, external services, clock, randomness, queues.

A mock shows that a call was requested, never its effect: a mocked write proves nothing about persistence. A mock that implements the asserted behavior proves the mock.

An export, flag, wrapper, or hook whose only caller is a test is a design smell. Test through a real boundary instead.

## Choosing the boundary

- Pure logic (calculations, algorithms, state transitions, edge cases): a focused unit test.
- Wiring, persistence, lifecycle: one test exercising real collaboration at the boundary, with hermetic dependencies, instead of a mocked unit test per layer.
- Critical user journeys: a few end-to-end tests.

Each contract has one owner. A second layer must exercise a risk the owner cannot reach: transport, persistence, concurrency, lifecycle, authorization. Business-rule cases are proved once, at their owner.

## Choosing cases

Pick representative cases, meaningful boundaries, and relevant failure paths: one case per distinct defect, not per input variation. When a general invariant expresses the requirement, one property test replaces many examples. Near-duplicates become one table-driven test, unless they protect different boundaries. Setup stays readable; helper chains hide the evidence.

## Bug fixes

One regression test, at the owning boundary. It fails on the defective code for the bug's reason and passes after the fix. When the baseline cannot be run, say so.

## Keeping and deleting

Tests written to drive the implementation are scaffolding. Once the behavior is proved at its boundary they go, unless one owns pure, stable logic. A test-only seam goes with its test.

Redundancy needs evidence: each failure mode the test detected remains detected elsewhere. A passing broader test, overlapping lines, or a history without failures establishes nothing.

Investigate a failing test before weakening its assertion or deleting it. It reveals a product bug, a bad fixture, or an obsolete contract.

## Hygiene

Small fixtures, isolated state, controlled time and randomness, completion signals instead of sleeps.
