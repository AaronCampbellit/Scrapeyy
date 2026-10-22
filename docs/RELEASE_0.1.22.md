# 0.1.22: Borrow Session download fix

Firefox rejected the popup's `data:application/json` download URL. Session capture completed, but saving failed. Browser exceptions could also echo the encoded session into the UI.

The popup now hands only the encoded file and protection mode to a background download handler. Firefox creates its Blob URL in the background document and retains it until completion or interruption, so closing the popup during Save As does not destroy the file. Chrome service workers retain the data URL path. Session contents stay transient; no session or passphrase is written to extension storage. The handler accepts only the extension's own popup, and errors return no URL or session contents.

Blob URLs are released after download completion, following [Mozilla's downloads guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download). The related [popup lifetime issue](https://bugzilla.mozilla.org/show_bug.cgi?id=2005952) explains why creating the Blob in the popup is insufficient.

Validation: strict staged TypeScript, 42 test files / 253 tests, both production targets, and compiled popup smoke for encrypted/plaintext export and decryption with synthetic browser APIs. Regression coverage includes delayed completion, cancellation, early completion, sender authorization, URL cleanup and error redaction. Installed Firefox/Zen Save As acceptance remains a manual reload-and-export check.
