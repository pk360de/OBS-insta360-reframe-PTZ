# Example assets

- `sphere_2880x1440.jpg`: complete 2:1 panorama. Inner lens is centered; outer lens is split across the horizontal seam. Retained unchanged from the supplied test artwork.
- `obs-scene-collection.json`: sanitized, image-only OBS collection **template**. Resolve `__REPO_ROOT__` before importing. See [scene import](../docs/scene-import.md).
- `ptz-demo-presets.json`: version 2 preset export containing Inner lens at pan 0° and Outer lens at pan −180°, both with tilt=0°, roll=0° and horizontal FOV=90°. Four additional slots are empty. Home defaults to inner/90°.

The presets target **PTZ - Demo 16x9 → PTZ - Perspective 16x9**. They contain no credentials or personal camera views. Importing them replaces the selected target's slots after confirmation; it does not reposition the view until Recall/Home is used.

The optional PowerShell helper writes prepared, machine-specific collection files to `.local/`; do not commit that directory. Camera hardware, the OBS profile and custom browser dock are intentionally not included in the collection.
