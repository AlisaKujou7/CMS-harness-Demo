# ADR-0016: Allow OFL-1.1 for the fonts 03-DESIGN names

## Status

Accepted, pending review by the Tech Lead

## Context

03-DESIGN §3.2 asks for Roboto Flex and Roboto Mono. Their packages, `@fontsource-variable/roboto-flex`
and `@fontsource/roboto-mono`, are under the SIL Open Font License 1.1, which M-LIC-03 does not list.
08-GIT-WORKFLOW §16.1 makes quality gate threshold changes a Tech Lead decision through an ADR.

## Decision

Except exactly these two packages under exactly OFL-1.1 in `tools/gates/checks.mjs`, the way ADR-0015
excepts the libvips binaries. OFL-1.1 lets fonts be bundled with software of any license, as long as
the fonts themselves are not sold alone. Any other OFL package still fails the gate.

## Consequences

- Positive: the admin panel shows the fonts its design names, from its own origin, with no request to
  a font CDN.
- Negative: the list in 05-METRICS M-LIC-03 needs updating to match.

## Alternatives Considered

Loading the fonts from Google Fonts, rejected because every admin page view would tell a third party
who is using the panel. Using system fonts only, rejected because 03-DESIGN names these fonts.
