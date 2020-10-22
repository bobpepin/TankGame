#version 100

precision highp float;

varying vec2 uv;

uniform highp sampler2D mapSampler;
uniform highp sampler2D groundSampler;
uniform float threshold;

// out vec4 fragColor;

void main() {
    vec4 fragColor;
    float nTiles = 50.0;
    vec2 uv1 = clamp(uv, 0.0, 1.0);
    vec2 tileUV = mod(uv1, 1.0/nTiles) * nTiles;
    float material = texture2D(mapSampler, uv).x;
//     fragColor = texture(groundSampler, vec3(tileUV, material));
    tileUV.x *= (0.5-1.0/128.0);
    tileUV.x += (0.5+2.0/128.0)*step(0.5, material);
    fragColor = texture2D(groundSampler, tileUV);
//     fragColor.rgb = tileUV.x > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
    fragColor.r = fragColor.g = fragColor.b = smoothstep(0.49, 0.51, material);
    gl_FragColor = fragColor;
}