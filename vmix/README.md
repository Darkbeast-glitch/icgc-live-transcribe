# vMix output

Everything needed to put scripture and lyrics into a vMix production.

Two moving parts:

- **The data source** — the current verse or song as XML, published by the app.
- **The `.xaml` titles here** — the graphics, with named fields bound to that data.

The XAML alone just shows its placeholder text. The data source is what makes it live.

| File | Use |
|---|---|
| `ScriptureLowerThird.xaml` | Verse reference, translation, verse body |
| `LyricsLowerThird.xaml` | Two lyric lines, song title, artist |
| `sample-output/data1.xml` | Offline stand-in for the live feed — **setup only** |
| `sample-output/image1.png` | Offline stand-in for the rendered projector frame |

Both titles are 1920×1080 with a transparent background, sitting in the lower third
inside the 5% broadcast-safe area. Colours follow `DESIGN.md` — `#F97316` accent, white
text on a near-black panel, drop shadows so text survives over a bright camera feed.

---

## Step 1 — Choose how the app publishes

### File output (vMix on the same PC as the app)

Turn on **Settings → vMix File Output**. The app keeps a folder on disk in sync with the
projector, rewriting it on every display change:

```
C:\Users\<you>\Documents\ICGC Live Word\Output\data1.xml     ← vMix data source
C:\Users\<you>\Documents\ICGC Live Word\Output\image1.png    ← vMix image source
```

On macOS the same folder is `~/Documents/ICGC Live Word/Output/`. The exact path is
shown in Settings with a Copy button, and **Change Folder…** moves it — somewhere short
like `C:\LiveWord\Output\` is fine.

This is the arrangement BibleShow uses (`C:\BibleShow5\Output\data1.xml`), so if you've
followed a BibleShow tutorial, the vMix half is identical.

No network, no ports, nothing to configure. Prefer this whenever it's an option.

### Web output (vMix on a different PC)

Turn on **Settings → vMix Web Output**, then use this as the data source URL:

```
http://<app-machine-ip>:7788/current.xml
```

Same XML, same fields, delivered over the network. Use the app machine's LAN IP, not
`localhost` — on the vMix PC, `localhost` points vMix at itself. Port 7788 must be open.

Verify in a browser on the vMix machine before you rely on it: that URL should return a
`<display>` document. Nothing is served until the output is switched on in Settings.

---

## Step 2 — Add the data source in vMix

**Settings → Data Sources → Add → XML.**

- **File output:** browse to `...\Output\data1.xml`
- **Web output:** paste the `http://…:7788/current.xml` URL
- **XPath:** `/display`
- **Refresh interval:** `500` ms — fast enough to feel instant, light enough to ignore

Laying out titles before the app is running? Point the data source at
`sample-output/data1.xml`. vMix reads it once, discovers the field names, and you can
bind and position everything offline. **Switch it to the real path before a service** —
the sample is a frozen John 3:16 and will never change on air.

## Step 3 — Add the title

**Add Input → Title → Browse →** pick a `.xaml` file.

## Step 4 — Bind the fields

Open the title's settings. Each text field has a Data Source column — pick the data
source, then the field:

| Scripture title | XML field |
|---|---|
| `Reference` | `reference` |
| `Translation` | `translation` |
| `VerseText` | `text` |

| Lyrics title | XML field |
|---|---|
| `Line1` | `line1` |
| `Line2` | `line2` |
| `SongTitle` | `title` |
| `Artist` | `artist` |

## Step 5 — Put it on an overlay channel

Use the overlay buttons to bring it in and out. Don't cut the title input to Program —
you want it *over* the camera.

---

## The shortcut: skip titles entirely

`image1.png` is the projector captured as a picture — full theme, background, fonts and
all. Add it in vMix as a **Photo/Image** input and you get output identical to the
projector, with no data source and no field binding.

The trade-off: it's a full-frame graphic, so it covers the camera. The XAML titles are
more setup, but vMix controls the look, so they can sit over live video as a lower
third. Full-screen scripture between camera shots — use the image. Scripture over a
preaching shot — use the titles.

## Copy the titles to the vMix machine

vMix is Windows-only, so copy this `vmix` folder across on a USB stick or shared drive.
A sensible home on the vMix PC:

```
C:\Users\<you>\Documents\vMixTitles\ICGC\
```

Nothing needs installing — vMix reads the `.xaml` from wherever you put it. Keep the
folder somewhere permanent, though: vMix stores the *path* in the preset, so moving the
files later breaks the title input.

## Fields the data source publishes

Whichever content type is showing determines which fields are populated. The rest come
back empty.

| Type | Fields |
|---|---|
| Verse | `type` `reference` `book` `chapter` `verse` `translation` `text` `line1`…`lineN` |
| Lyrics | `type` `title` `artist` `text` `line1`…`lineN` |
| Note | `type` `heading` `text` |

`book`, `chapter` and `verse` are the reference split into parts, for layouts that set
the chapter and verse in a different size or colour.

## Things worth knowing

**Both titles read the same source.** When a verse is showing, the lyrics title's fields
go blank, and vice versa. Control which is visible with vMix overlays — the titles don't
hide themselves.

**Lyric lines are two discrete fields, not one wrapping block.** Songs break where the
writer broke them; a wrapping box breaks where the box ends. For more lines, copy the
`Line2` block, bump `Canvas.Top` by 60, and name it `Line3` — the data source already
publishes `line3` and beyond.

**Long verses clip.** `VerseText` fits roughly three lines at 40px before `TextTrimming`
cuts it with an ellipsis. For long passages either send the range in smaller pieces, or
drop `FontSize` to 34 and raise the panel `Height`. Clipping is deliberate — silently
shrinking text mid-service is worse than a visible cut.

**Fonts.** `Segoe UI` and `Segoe UI Semibold` ship with Windows. Install any replacement
font on the vMix machine — vMix renders with WPF and silently falls back to a default if
the font is missing.

**`x:Name` is the field name vMix lists.** Rename a `TextBlock`'s `x:Name` and you'll
re-bind that field in vMix.

**Images displayed from the Media tab** reach vMix only through `image1.png` — they're
local files, so the web output sends a `clear` instead.
