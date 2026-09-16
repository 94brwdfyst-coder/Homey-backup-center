# Build review — 15 September 2026

## Verified base

Repository: https://github.com/94brwdfyst-coder/Homey-backup-center

Base: `dd3b5a7ba4175e58138fa5046b8bedeb3b1be7ab` (`main`). The available local 0.3.27 code matched GitHub's application files. GitHub's newer CREDITS and PROVENANCE-REPORT were preserved. No GitHub issues were returned by the connected issue search. The known browser feedback in the referenced conversation names Android browsers and Windows Firefox/Chrome but does not contain complete reproduction steps or a browser error trace.

The new browser fix separates explicit download from sharing, tolerates restricted file-sharing capability queries and preserves object URLs across back/forward-cache navigation. It is covered by four simulated browser tests, but is not represented as a proven resolution of Peter_Kawa's full device report.

## Provenance scope and findings

- Existing PROVENANCE-REPORT.md and CREDITS.md remain the record of Mike_Nono/Sven permission context. This run does not independently authenticate private messages or expand those permissions.
- Compared the application's **base** JS/HTML against historical JS/HTML/Python blobs of `smarthomesven/homey-flow-version-history` at `f633db30ab5889bfbfa6a966676690ec3bb54a35` (46 commits, 15 unique path/code blobs) and `Halfwalker/Homey-Backups` at `1d5d0a02d4911003da0ca61ad5350c9352e40ae3` (118 commits, 94 unique path/code blobs).
- After stripping comments and tokenizing, no identical contiguous window of 20 tokens was found. This is a narrow, reproducible exact-token check, not proof of independent creation. Identifier-renamed, translated or structurally rewritten implementations may not match. The earlier Sven report contains the broader manual/normalized comparison.
- Flow Version History has GPL-3.0. Halfwalker's checked-out tree has no LICENSE/COPYING file or license declaration in README/pyproject. No code was copied from either project for this build.
- `https://github.com/Dijker/nl.regoor.flowbackup` could not be cloned anonymously (Git requested credentials). Its current contents, history and licensing could not be verified. That part of the requested review remains blocked; public forum descriptions are not source-code evidence.
- New SMB/SFTP adapter, service, settings UI and Flow registration were written for this change from library/SDK interfaces. Existing external-app code was not imported.
- The project root still has no LICENSE file. This run does not assign a new license or claim that distribution permissions are fully cleared. Existing credits/permission context must be retained, and the project owner must settle the intended project license before public redistribution under a particular license.

Evidence: `flow-version-history.json`, `homey-backups.json`, `compare.py`. The comparison script records the session's source locations; adjust paths when reproducing elsewhere. Base commits and external heads above pin the compared versions. Only those two external source histories were fully checked in this run.

## Dependencies and notices

- `@awo00/smb2` 1.1.1: MIT; package LICENSE names stifani (2020). Its README identifies the ardean fork and NTLM code lineage. Supports SMB2, not SMB3 encryption or required signing.
- `ssh2-sftp-client` 12.1.1: Apache-2.0; `ssh2` uses MIT. No dependency source modifications.
- Existing `homey-api` 3.19.2: **custom Athom terms, not MIT**. Its LICENSE allows use with Homey products and identifies the source as proprietary to Athom B.V. This is a Homey app; retain those terms and do not relicense the dependency.
- `THIRD-PARTY-NOTICES.txt` preserves shipped runtime license/notice texts; `dependencies.json` inventories versions and license metadata. `package-lock.json` pins package integrity hashes. Dependencies that omit a separate license file are listed by metadata and must retain their package metadata/source notices.
- Homey CLI, ESLint and jsdom are development tools and excluded from runtime packaging by the Homey builder. Their own packages retain their licenses.

Primary interface references: https://github.com/awo00/smb2 ; https://github.com/theophilusx/ssh2-sftp-client ; https://apps.developer.homey.app/the-basics/flow .

## Security audit limitations

The production audit reports the pre-existing `parseuri` advisory GHSA-6fx8-h7jm-663j and three affected parent packages (four moderate package findings). No advisory is reported for the new SMB/SFTP production dependencies in the saved audit. `npm audit fix` was attempted without `--force`; remaining proposed major/downgrade changes were not applied because they would change Homey APIs/toolchain compatibility. The full development-tool audit also has outstanding findings; consult the attached JSON for exact current counts and affected versions. These findings are not hidden by the successful lint/build/test results.

## Runtime acceptance still required

Real NAS SMB compatibility (including server signing policy), actual Homey Flow scheduling/events, Homey hardware memory behavior on large backups, and Android/Windows browser retesting were not performed. No Homey installation, network backup to the user's NAS, restore, push, merge or release was performed.

### Additional unresolved notice metadata

The pre-existing transitive packages `component-bind@1.0.0`, `component-inherit@0.0.3` and `indexof@0.0.1` ship neither a license field nor a standalone license file in the installed package. Their redistribution rights were not independently resolved in this run. Several other old packages omit license files but do have license metadata; the inventory distinguishes these cases. Missing package metadata is not proof that no upstream license exists. This is an open provenance item, not a clean bill of licensing compliance.
