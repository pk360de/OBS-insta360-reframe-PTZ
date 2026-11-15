// obs-shaderfilter 2.6.1: load as shader text, Use Effect File OFF.
// Input: stitched full-sphere equirectangular image (360 x 180 degrees).
// Output geometry: 16:9, horizontal FOV. This filter does not resize the source.
// In the documented scene-filter setup, stretch the ENTIRE panorama source
// to the 16:9 canvas BEFORE the scene filter. No cropping or letterboxing.
// If used directly on a source instead, stretch its filtered output to 16:9.
// Extra pixels left/right/top/bottom must all remain zero.
// A raw dual-fisheye or pre-reframed webcam image is not a valid input.

uniform float pan<
    string label = "Pan (degrees, positive right)";
    string widget_type = "slider";
    float minimum = -180.0;
    float maximum = 180.0;
    float step = 0.1;
> = 0.0;

uniform float tilt<
    string label = "Tilt (degrees, positive up)";
    string widget_type = "slider";
    float minimum = -90.0;
    float maximum = 90.0;
    float step = 0.1;
> = 0.0;

uniform float roll<
    string label = "Roll (degrees)";
    string widget_type = "slider";
    float minimum = -180.0;
    float maximum = 180.0;
    float step = 0.1;
> = 0.0;

uniform float fov<
    string label = "Horizontal FOV (degrees)";
    string widget_type = "slider";
    float minimum = 10.0;
    float maximum = 150.0;
    float step = 0.1;
> = 90.0;

// Own name: textureSampler is already declared by the plugin template.
sampler_state ptzSampler {
    Filter = Linear;
    AddressU = Wrap;
    AddressV = Clamp;
};

float4 mainImage(VertData v_in) : TARGET
{
    float pi = 3.141592653589793;
    float d2r = pi / 180.0;
    float aspect = 16.0 / 9.0;
    float2 p = v_in.uv * 2.0 - 1.0;
    float extent = tan(clamp(fov, 10.0, 150.0) * d2r * 0.5);
    float3 dir = float3(p.x * extent, -p.y * extent / aspect, 1.0);

    // Camera-local roll, then tilt, then world-up pan.
    float cr = cos(roll * d2r);
    float sr = sin(roll * d2r);
    dir = float3(cr * dir.x - sr * dir.y,
                 sr * dir.x + cr * dir.y, dir.z);

    float ct = cos(tilt * d2r);
    float st = sin(tilt * d2r);
    dir = float3(dir.x, ct * dir.y + st * dir.z,
                 -st * dir.y + ct * dir.z);

    float cp = cos(pan * d2r);
    float sp = sin(pan * d2r);
    dir = float3(cp * dir.x + sp * dir.z, dir.y,
                 -sp * dir.x + cp * dir.z);
    dir = normalize(dir);

    float longitude = atan2(dir.x, dir.z);
    float latitude = asin(clamp(dir.y, -1.0, 1.0));
    float2 eqUV = float2(frac(longitude / (2.0 * pi) + 0.5),
                         0.5 - latitude / pi);
    return image.Sample(ptzSampler, eqUV);
}
