# Installation

## 1. Install the dependencies

Install [OBS Studio](https://obsproject.com/download) and the matching [obs-shaderfilter release](https://github.com/exeldro/obs-shaderfilter/releases) for your platform/OBS version. Restart OBS after installing the plugin. This release was checked on Windows with OBS 33.0.1 and obs-shaderfilter 2.6.1; do not interpret those numbers as a claim that every earlier or later version works.

The built-in OBS WebSocket v5 server is needed only for the dock. A shader-only/manual-control workflow does not need it. The optional [Move plugin](https://github.com/exeldro/obs-move-transition) is not bundled and is not required.

## 2. Place the project files

Extract the complete repository to a permanent directory, for example `C:\OBS-PTZ\`. Do not load the shader or dock from a temporary ZIP preview or a GitHub HTML/raw page. Moving the directory later requires updating the shader path and browser dock URL in OBS.

Keep these dock files together:

```text
dock/insta360-ptz.html
dock/insta360-ptz.js
dock/insta360-ptz-core.js
dock/insta360-ptz-i18n.js
dock/insta360-ptz-presets.js
dock/locales/de.js
dock/locales/en.js
dock/locales/es.js
```

## 3. Choose an input

Start with `example/sphere_2880x1440.jpg`. It proves the setup without camera driver or webcam-mode dependencies.

Both the **Insta360 X4 and X5** can provide the input: their Webcam Mode offers the same resolution-based choice of output. Connect the camera in **Webcam Mode**, add it as an OBS **Video Capture Device**, set **Resolution/FPS Type** to **Custom**, and select **2880×1440** as the capture resolution.

| Camera capture resolution in Webcam Mode | Delivered image | Suitable for this shader |
| --- | --- | --- |
| **2880×1440** | Full stitched 360° equirectangular panorama (360×180° sphere) | **Yes — select this mode** |
| **1920×1080** | Reframed or split-screen video | **No — the full sphere is unavailable** |

These are the **camera source's capture settings**, not the OBS canvas or output resolution. Keep the documented OBS canvas at **1920×1080** and stretch the complete 2880×1440 panorama onto it before applying the scene shader, as described in [OBS setup](obs-setup.md).

Confirm the unfiltered source shows the **entire stitched equirectangular sphere**. The shader does not stitch fisheye lenses or recover areas omitted by a reframed or split-screen feed. The X5 was used for the project's development checks; the X4 follows the same Webcam Mode setup but was not separately tested for this release.

Then continue with [scene import](scene-import.md) or [manual OBS setup](obs-setup.md), followed by [dock setup](dock-setup.md).

## Updating

Back up important views with the dock's Export button. Replace the repository files as a set, then refresh the dock and reconnect. A refresh requires entering the WebSocket password again. This distribution uses its own browser-storage namespace, separate from the development dock. Moving files or clearing OBS browser data can affect local storage; JSON exports are the portable backup.
