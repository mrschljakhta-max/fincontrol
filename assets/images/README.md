# FINCONTROL panorama — 8 backgrounds

Upload the files from `FINCONTROL_8_SCENES_GitHub_upload.zip` to **this GitHub folder**: `assets/images/`.

There are 16 `.webp` files:

| Scene | Desktop 2560×1440 | Mobile 1080×1920 |
|---|---|---|
| Hero | `fincontrol-bg-01-hero.webp` | `fincontrol-bg-01-hero-mobile.webp` |
| Overview | `fincontrol-bg-02-overview.webp` | `fincontrol-bg-02-overview-mobile.webp` |
| Calendar | `fincontrol-bg-03-calendar.webp` | `fincontrol-bg-03-calendar-mobile.webp` |
| Credits | `fincontrol-bg-04-credits.webp` | `fincontrol-bg-04-credits-mobile.webp` |
| Reserve | `fincontrol-bg-05-reserve.webp` | `fincontrol-bg-05-reserve-mobile.webp` |
| Housing | `fincontrol-bg-06-housing.webp` | `fincontrol-bg-06-housing-mobile.webp` |
| Analytics | `fincontrol-bg-07-analytics.webp` | `fincontrol-bg-07-analytics-mobile.webp` |
| Final | `fincontrol-bg-08-final.webp` | `fincontrol-bg-08-final-mobile.webp` |

The actual code is already committed: `experience.html` loads `assets/experience-scenes.css`, with each section's independent `background-size:cover` image and a separate mobile variant. The original vector art is retained as a fallback. The animated rock/phone and finance logic are unchanged.

**Asset fidelity:** These first-version wallpapers are reframed and resampled using existing FINCONTROL source images; pixel dimensions are 2560×1440 and 1080×1920, but native photographic detail is limited by the original images. They are not newly generated at full target resolution.

Upload the images to GitHub without renaming. GitHub's website does not automatically unpack ZIP files into the repository.


## Detailed moving hero crystal

Upload `fincontrol-core-rock.webp` from `FINCONTROL_detailed_crystal_GitHub_upload.zip` into **this same assets/images folder**.

The code in `experience.html` and `assets/experience-photo-core.css` switches to the high-detail transparent cutout only after loading succeeds. If it is missing, the old SVG still works.

The full-bleed background fix is in `assets/experience-scenes.css`. Images now extend to the left and right screen edges, while text, cards and buttons remain confined to the readable content column.

The stone is still a 2D graphical layer with simulated rotation, pulsation, glowing rings, drifting fragments, and a scroll-driven transition into the phone. A genuine perspective-correct 3D orbit would require a dedicated 3D asset later.
