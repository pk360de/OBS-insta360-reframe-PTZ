# Validation and reproducibility

## Environment

Documentation and live example checks were performed on Windows with **OBS Studio 33.0.1** and **obs-shaderfilter 2.6.1**. A separate portable OBS copy, English UI, image-only demo collection and separate browser data were used. The regular development OBS scene collection and its presets were not used as a test target.

The documentation instance used canvas 1920×1080, output 1280×720, 30 FPS and WebSocket port 4456. Port 4456 is an isolation choice, not a project requirement. A normal installation commonly uses 4455.

## Automated checks

Install Node.js to run the development tests; it is **not** needed to use the shader/dock in OBS. No npm packages are required.

```text
node tests/ptz-integration-test.cjs
node tests/repository-check.cjs
```

The simulated OBS/DOM integration checks cover authentication, target validation, coalesced PTZ writes, dragging/zoom, default mouse lock, preset recall/stop, scene-collection disarm, demo migration without overwriting existing views, home settings, dynamic slots, clear/delete/cancel, old/new imports, compact mode, preview pause/resume and complete de/en/es dictionaries. They do not replace browser rendering, native OBS import or camera-driver tests.

The repository check verifies scene/preset target names, complete image transform, zero crop, template paths, storage namespace isolation, shader geometry constants and local Markdown/image links. The Windows helper is additionally exercised with a repository path containing spaces and produces parseable JSON.

## Live documentation checks

- The sanitized image-only collection loads with the shader enabled in the isolated OBS configuration.
- The full panorama covers the full canvas; transform settings are captured in [image-transform.jpg](screenshots/image-transform.jpg).
- The inner label is centered at pan 0° and the outer label across the seam at the opposite direction, with tilt/roll 0° and horizontal FOV 90°.
- Shader loader mode, zero extra pixels, PTZ controls, video settings and local browser-dock setup are recorded as actual OBS screenshots.
- Dock connection, neutral demo views, compact layouts and home settings are checked in the isolated session.

## Limits

The X5 was used during development, but the public import test deliberately needs no camera and contains no device configuration. No cross-platform or exhaustive OBS/plugin-version matrix is claimed. The scene collection does not install plugins or transfer profile/video settings, browser docks or browser-local presets. Preparing/relinking file paths remains a required import step.

The native dock auto-resize/restore plugin is a future idea, not a feature of this release. No GitHub remote, release or public upload is created by preparing this local repository.
