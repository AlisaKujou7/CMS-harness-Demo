# ADR-0015: Allow the libvips binaries that sharp loads

## Status

Accepted, pending review by the Tech Lead

## Context

FR-MEDIA-05 needs image variants, and 01-Requirements RK-05 names an image resizing pipeline. `sharp`
is Apache-2.0, but its prebuilt `@img/sharp-*` packages include libvips under LGPL-3.0-or-later, which
M-LIC-03 does not allow. 08-GIT-WORKFLOW §16.1 makes quality gate changes a Tech Lead decision through
an ADR.

## Decision

Add an exception in `tools/gates/checks.mjs` for packages named `@img/sharp-*` under exactly those
licenses. LGPL allows use as an unmodified, separately loaded library, which is how sharp uses it. We
do not modify or statically link it. Every other LGPL package still fails the gate.

This is an engineering reading of the license, not legal advice, and it needs the Tech Lead's or
counsel's confirmation before any distribution of the software.

## Consequences

- Positive: fast variants, with SVG rasterizing and auto-orientation, and no native build step.
- Negative: distributing container images must meet LGPL terms for libvips, such as including its
  license and allowing it to be replaced.

## Alternatives Considered

A pure JavaScript resizer such as jimp, rejected because it is slow on 20 MB images, cannot write WebP
or read SVG, and would block a worker's event loop. A waiver, rejected because it expires after 30
days while this dependency is permanent. An external image service, rejected as new infrastructure.
