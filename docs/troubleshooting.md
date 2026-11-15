# Troubleshooting

## Outer lens is missing at pan 180°

Check the input scene item **before** changing the projection formula. The whole panorama must be stretched onto the whole 1920×1080 canvas. An unscaled 2880×1440 image centered on that canvas still loses its edges. Those edges contain the outer-lens label and the panorama seam; a scene filter cannot recover pixels outside the scene texture. Use Stretch to Screen, position 0,0, Stretch bounds 1920×1080, zero crop and rotation. See the [transform screenshot](screenshots/image-transform.jpg).

## The view is offset, stretched or letterboxed

Confirm the canvas is 16:9, the shader is on the **scene**, and the full panorama covers that canvas without margins. Fit to Screen and Scale to inner bounds preserve the raw 2:1 ratio and introduce unused space; use the documented stretch. Check all four shader Extra pixels values are zero. Remove a duplicate shader from the camera/image source if you accidentally applied it twice.

## The shader fails to load / unknown error

Install obs-shaderfilter, restart OBS, select the real local `.shader` file and leave **Use Effect File** off. This file uses shaderfilter's `mainImage` template syntax. A generic GLSL/Shadertoy shader or a full OBS effect uses a different interface. Plugin binaries are not bundled with this repository.

## The camera still looks wrong

Verify an unfiltered frame. It must be the full stitched 360×180° equirectangular sphere. A 2:1 image size does not prove that the camera is in this mode. Raw dual fisheye needs stitching first. Mirroring, cropping, lens-specific webcam modes or software reframing change the mapping. Establish pan zero against the camera's panorama center rather than assuming all firmware uses the same orientation.

## Dock is blank or buttons do nothing

Use the local file URL ending in `dock/insta360-ptz.html` and keep its JavaScript and locales together. Check Connection & target, enter the current server password, and match the exact scene and filter names. The shader filter must be enabled and its filename must end in `insta360_ptz_reframe.shader`. A scene-collection switch requires reconnecting. If in compact mode, use ⤢ to expand and inspect the error.

## Cannot connect

Enable OBS WebSocket, keep authentication enabled and match its port. Only localhost/127.0.0.1 is accepted. Normal OBS commonly uses 4455; the screenshots' isolated documentation session uses 4456. An authentication failure requires the correct password, entered in the dock itself. Refreshing loses the in-memory password by design.

## Presets seem missing

Presets are browser-local and target-specific. Changing endpoint, port, collection, scene, filter, browser data or file location can select a different store. Restore a JSON export to the intended target after checking it. Do not assume a scene collection export contains browser-local presets. The supplied demo initializer only seeds the exact example target if there is no saved list; an intentionally emptied list remains empty.

## Scrolling accidentally changes the view

Lock mouse control. The locked preview lets the wheel scroll the page. Numeric fields and sliders retain their normal input behavior; move the pointer off them before scrolling the page. The mouse lock affects preview gestures, not the explicit PTZ controls.

## Compact mode leaves a large empty panel

Its contents have collapsed, but OBS retains the outer dock size. Resize the dock manually. Automatic native resize/restore is not part of this browser-only implementation.
