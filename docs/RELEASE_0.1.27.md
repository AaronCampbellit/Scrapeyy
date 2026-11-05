# 0.1.27: Borrow session permission prompt recovery

When Zen/Firefox placed its permission prompt behind Scrapeyy, the popup displayed a vague Connecting message. An unanswered native permission promise could keep Scan and Record disabled even after the background reported a timeout.

The popup now immediately says **Waiting for browser permission** and explains how to close the popup, answer the browser prompt and return. Stop is available while waiting. Both the popup request and persisted background wait have a one-minute deadline. Errors leave Scan/Record available for retry, and the scanner also checks actual browser grants if the native request promise is delayed.

Cancellation is tied to an individual attempt. Stopping while waiting does not trigger a final scan; only stopping an active recording does. Late permission results cannot restart a stopped attempt or cancel a newer retry. Existing origin selections are retained. Permission requests remain directly tied to the button click, and browser grants are not automatically revoked.

Validation: TypeScript checking and all 274 tests across 45 files pass, including permission-prompt, timeout and cancellation regressions. The popup reminder and Stop/retry controls were also checked in a browser preview using simulated permission responses. Chrome MV3 and Firefox MV2 builds use the same source and lockfile. Native prompt placement and installed-browser reload are not automatically verified; manually reload the existing extension and confirm 0.1.27. Previous browser-management policy restrictions remain in effect.
