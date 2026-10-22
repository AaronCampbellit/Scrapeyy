# Combined release 0.1.18

This release combines private release `bc546aac789354bf8135b10840648d1479176bbc`
with public main `95b621b3cfec605a4acab55719942e259784ad10`. The public repository
retains its separate publication history; private design originals remain in
the private source tree.

Preserved from the private release:

- Embedded document viewer access and screenshots, including user-gesture permissions.
- Full-page capture of reversed chat conversations and viewport-constrained panes.
- Screenshot destinations, PNG clipboard copying, and Inbox Copy image.
- Wistia video discovery, MP4 quality choices, transcripts, TXT, VTT, and SRT.
- Expansion inside the popup with resizing, Back/Escape, and focus restoration.

Preserved from the public source:

- Explicitly approved session borrowing, optional cookie access, encryption on by
  default, standalone decryption, interoperability fixtures, and scope checks.
- Separate preview windows, available alongside inline expansion.
- Public usage guides, screenshots, original SVG icons, dependency updates, legal
  notices in both browser builds, and picker stylesheet packaging.

Validation on 2026-10-22:

- Strict TypeScript checked against fresh generated build types.
- 39 Vitest files / 235 tests passed, including crypto/capture tests from public,
  private screenshot/media regressions, and a combined popup workflow test.
- Chrome MV3 and Firefox MV2 production builds passed with one dependency lockfile.
- Ten scrolling-page fixtures, compiled preview checks, and PNG clipboard checks passed.
- The installed Chromium session-export smoke test was denied with `spawn EPERM`
  on the initial attempt and three retries. No alternate executable or security
  workaround was used. Native optional-permission dialogs and real account/session
  transfers remain manual acceptance checks.

Local browser build paths remain `.output/chrome-mv3` and `.output/firefox-mv2`
under the existing release worktree. Reload the existing extension and refresh
site tabs before testing. Preserve the extension installation and its saved data.
