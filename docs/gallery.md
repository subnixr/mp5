# Gallery mode

Gallery mode lets you load a whole folder of sketches at once and cycle through them live — useful for performing sets, showcasing work, or auditioning multiple visuals against the same track.

## Activating gallery mode

Pass a directory as the sketch path:

```sh
mp5 my-sketches/
mp5 my-sketches/ track.mp3
```

MP5 scans the directory at startup for `.zip` files and subdirectories. Each item that contains a `sketch.js` entry point becomes a sketch in the gallery. The first sketch loads immediately; the rest are queued.

## Navigating sketches

| Key         | Action          |
| ----------- | --------------- |
| `Tab`       | Next sketch     |
| `Shift+Tab` | Previous sketch |

Switching is instant — the new sketch fades in over the currently playing audio without interrupting playback.

## Settings window — Gallery tab

Open the settings window (`F12` or the **Params** button) to find the **Gallery** tab alongside the usual Params tab. It gives you full control over the queue:

### Sketch cards

Each sketch in the directory appears as a card with:

- **Preview thumbnail** — a JPEG screenshot captured automatically 500 ms after the sketch first loads. Thumbnails are stored in `<gallery-dir>/.mp5-previews/` and regenerated each time a sketch is visited.
- **Name** — the directory or zip name.
- **Enabled checkbox** — uncheck to exclude a sketch from the rotation. Disabled sketches are skipped by Tab/Shift+Tab and by autoplay.

### Shuffle

Enable **Shuffle** to randomize the order instead of cycling sequentially. A new shuffle queue is built whenever shuffle is toggled on or the enabled set changes.

### Autoplay

Set **Autoplay (s)** to a positive number to advance to the next sketch automatically after that many seconds. Set it to `0` to disable autoplay. Manual Tab/Shift+Tab navigation resets the timer.

## Opening the gallery directory

Right-click the **Sketch picker** button in the controls bar to open the gallery directory in your system file manager.

## Notes

- Gallery items must be `.zip` files or subdirectories — both must contain `sketch.js` as the entry point. Bare `.js` files at the gallery root are ignored.
- Zip contents and directory sketches can bundle any assets alongside `sketch.js`; assets are accessible via relative paths.
- Zip files are extracted to a temporary directory on launch; extracted contents are cleaned up when the app exits.
- Sketches added to the directory after launch are not picked up automatically; restart to refresh the list.
- Preview thumbnails are JPEG files written to `<gallery-dir>/.mp5-previews/`. You can delete this folder at any time; thumbnails will be regenerated on the next visit.
