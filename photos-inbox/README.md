# Photo inbox

Got a sponsor photo as a file (emailed, texted, downloaded) instead of a
web link? Put it here.

## How

1. On this page in GitHub, click **Add file → Upload files**, drag the
   image in, and click **Commit changes**.
2. In the Google Sheet, put the **exact filename** (e.g. `red-granite.jpg`)
   in that venue's `photo_url` cell — no URL needed.
3. Done. The next build (within the hour, or on the next push) resizes it,
   publishes it, and the photo appears on the listing.

## Rules of the folder

- JPG, PNG, or WebP. Any size — the build resizes to web-friendly
  automatically, so upload the original.
- Filenames: letters, numbers, dots, dashes, spaces. Keep them simple and
  venue-recognizable: `red-granite.jpg`, not `IMG_4382 (3).jpg`.
- **To replace a venue's photo later, upload the new file under a NEW
  name** and update the sheet cell — same rule as web links, where a
  changed URL means a changed photo. Re-uploading over the same filename
  won't refresh the published photo.
- If the sheet names a file that isn't here, the build stops and says
  exactly which filename it was looking for.
- Photos on paid listings only (standard/featured tier) — on a free row
  the photo stays parked and unpublished until the tier changes.
