# Projection and processing order

The shader samples a stitched full-sphere equirectangular panorama. The panorama center (u=0.5, v=0.5) is longitude=0°, latitude=0°. The horizontal seam at u=0/1 represents the opposite direction, ±180°. Top and bottom represent the poles. The test pattern deliberately splits **outer Lens** over the seam.

## Perspective rays

For an output pixel with normalized coordinates `(u,v)`, let `x=2u−1`, `y=2v−1`, aspect `a=16/9`, and `t=tan(horizontalFOV/2)`. The unrotated ray is:

```text
direction = normalize(x*t, -y*t/a, 1)
```

The shader applies roll around the local forward axis, then tilt, then pan around world up. It converts the resulting direction to longitude/latitude and samples:

```text
longitude = atan2(direction.x, direction.z)
latitude  = asin(clamp(direction.y, -1, 1))
sampleU   = frac(longitude/(2*pi) + 0.5)
sampleV   = 0.5 - latitude/pi
```

The sampler wraps horizontally and clamps vertically. Horizontal FOV is clamped to 10–150°, avoiding the 180° singularity of a rectilinear perspective camera. Vertical FOV is `2*atan(tan(horizontalFOV/2)/(16/9))`, not a linear division of the angle.

## Why stretching the raw panorama is correct here

```text
Complete 2:1 panorama
  → scene-item stretch to the complete 16:9 canvas
  → scene shader samples panorama coordinates
  → perspective 16:9 frame
  → OBS output scaling
```

The shader receives a texture, not the original JPG/camera dimensions or its scene-item transform. A normalized sample coordinate addresses the same panorama location after a full-frame stretch. Cropping or margins before the shader instead remove/reassign panorama coordinates. Centering an oversized source only aligns its center; it does not preserve the whole sphere.

This release's documented setup is a scene filter. A direct-source shader workflow would need a different placement of the final 16:9 stretch. Do not mix instructions from those two pipelines.

## Limitations of a simple virtual PTZ camera

The shader changes viewing direction and field of view, not viewpoint position; it cannot create parallax or move physically through the scene. Source stitching artifacts, optical calibration errors and compression remain in the sampled image. Pan near the poles and combined roll/tilt follow the implemented Euler rotation order. Mouse dragging is an approximate angular control with FOV/roll-aware sensitivity, not an exact spherical trackball.
