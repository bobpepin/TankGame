#version 100

precision highp float;

varying vec2 uv;
varying vec3 pos;
varying vec3 norm;

uniform highp sampler2D groundSampler;

uniform float time;
// uniform vec4 color;

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    const float twopi = 2.0*3.141592;    
//     float time = 10.0;
    vec3 light = vec3(sin(time*1e-1), cos(time*1e-1), 1.0);
//     vec3 light = vec3(0.0, 1.0, 1.0);
    float nTiles = 50.0;
    vec2 uv1 = clamp(uv, 0.0, 1.0);
    vec2 tileUV = mod(uv1, 1.0/nTiles) * nTiles;
    float material = pos.z / 3.0;
    float x1 = tileUV.x * (0.5-1.0/128.0);
    float x2 = x1 + (0.5+2.0/128.0);
    float y = tileUV.y;
    float r = smoothstep(0.15, 0.35, material);
    vec4 fragColor1 = texture2D(groundSampler, vec2(x1, y));
    vec4 fragColor2 = texture2D(groundSampler, vec2(x2, y));
//     fragColor.rgb = tileUV.x > 0.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
//    fragColor.r = fragColor.g = fragColor.b = smoothstep(0.49, 0.51, material);
    vec4 color = (1.0-r) * fragColor1 + r * fragColor2;

    
//     vec4 color = vec4(uv.x, 1.0, uv.y, 1.0);
    float l = dot(normalize(norm), normalize(light));
//     gl_FragColor = vec4(hsv2rgb(vec3(pow(l, 5.0), 1.0, 1.0)), 1.0);
    gl_FragColor = vec4(l*color.rgb, color.a);
//     gl_FragColor = vec4(hsv2rgb(vec3(l, normalize(norm).yz)), 1.0);
//     gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
}