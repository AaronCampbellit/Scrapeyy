# Scrapeyy project instructions

## Endpoint security and blocked actions

This Windows device has enterprise EDR and ThreatLocker controls installed. If a safe, in-scope command or executable is explicitly blocked by one of these controls:

- Do not disable, weaken, evade, or work around the security control.
- Retry the same action up to three additional times, allowing a short pause between attempts so the user has time to notice and approve or unblock it.
- If it remains blocked, use only the least invasive alternative that preserves the requested outcome and does not materially expand the scope of the task.
- If no minor alternative is available, or the block is a major roadblock, stop and clearly tell the user what action or file was blocked and what needs to be unblocked before work can continue.

Browser-tool security restrictions also apply. Do not bypass a blocked extension manager through CDP, profile edits, shell automation, or another browser surface.

## Workspace hygiene

- Keep all temporary build artifacts, staging directories, extracted packages, scratch files, and other disposable task output inside the current project's `work` directory.
- Stop any background development servers started for a task when the work is finished, unless the user explicitly asks to keep them running. Tell the user when each server has been stopped.
- Existing `.output/chrome-mv3` and `.output/firefox-mv2` folders are the durable local extension builds. Preserve those paths when refreshing an existing unpacked installation; stage disposable build output and backups inside `work`.

## Read-only request boundaries

- For requests to investigate, review, verify, or brainstorm, remain read-only until the user explicitly asks for implementation or another state-changing action.

## Source and repository synchronization

- Start by checking `git status`, `git worktree list`, branch tracking, and the source version. The Windows release worktree is normally `.worktrees/scrapeyy-v1`; verify its current branch rather than assuming the repository root or GitHub's default branch contains the latest release.
- Preserve unrelated edits and separate feature or pull-request branches. Do not force-push, reset user work, merge unrelated branches, or downgrade a newer build merely to match an older default branch.
- When the task authorizes repository synchronization, fetch the configured remote, synchronize the relevant branches safely, and verify the final remote commit and upstream ahead/behind counts. Keep these instructions in both the default checkout and the active release branch when both are maintained.
- The combined application is maintained in private remote `origin` (`Scrapeyy`) and public remote `public` (`Scrapeyy-public`, branch `main`). Keep their runtime source, dependency lockfile, and release version aligned when an authorized release changes shared behavior. Preserve the public repository's separate history: publish the reviewed source tree on top of public `main`, without pushing private commit ancestry. Retain `docs/design/` privately and exclude it from the public source tree and source ZIPs. Preserve public documentation, legal notices, SVG icon source, and the optional Borrow session workflow alongside screenshot, clipboard, media, and both preview workflows.

## Keep Chrome and Firefox releases current

For authorized changes to extension code, assets, manifests, or dependencies, updating local browser builds is part of completing the task:

1. Use the same intended source revision and dependency lockfile for both Chrome MV3 and Firefox MV2. Keep `package.json`, the root lockfile version, and both generated manifest versions consistent. Use an appropriate release version when publishing a behavior change.
2. Run TypeScript checking and the meaningful regression checks for the change, then build both browser targets. Stage temporary build output inside `work`.
3. Refresh both durable `.output` build folders after successful validation. Verify the complete file sets and SHA-256 hashes against the staged builds; preserve prior builds inside `work` when replacing them.
4. Identify the actual installed Scrapeyy instance and its source in each relevant browser, including the Codex in-app browser when available. A ZIP import may be a separate copy from an unpacked `.output` installation. Updating files on disk does not prove that a running extension was updated.
5. Reload or update existing installations through supported extension-management controls, preserving extension identity, saved captures, recipes, and settings. Avoid uninstalling or clearing browser data as an update method. Respect requests for the user to perform browser testing.
6. Reopen the extension, verify the installed version, and check the changed behavior. Refresh affected site tabs when content scripts need to be reloaded. Do not mark an installed extension current based only on a source version, build manifest, ZIP, or successful Git push.
7. If installation or reload is blocked or unavailable, finish the safe build and packaging work, provide the exact current folder or ZIP and expected version, and clearly identify the manual browser action still required. Do not claim the installed browser was updated or tested.
8. For an authorized release or synchronization task, commit and push the source and project-instruction changes, then verify the remote SHA. Report build/package validation and installed-browser validation separately.

For documentation-only changes, do not rebuild or reload unchanged extension code unnecessarily. Verify existing source/build versions and file hashes when freshness is in question. These instructions govern future authorized work; they do not install a background updater or authorize changes during read-only reviews.
