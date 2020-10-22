#version 300 es

precision highp float;

uniform vec3 color;
uniform float time;

in vec2 texcoord;
uniform sampler2D sampler1;
uniform sampler2D sampler2;
uniform sampler2D sampler3;
uniform sampler2D sampler4;

out vec4 fragColor;

void main() {
    vec4 bgColor = vec4(color.r, color.g, color.b, 1.0);
//    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
    vec4 fgColor = vec4(1.0, 1.0, 1.0, 1.0);
    vec4 cloudColor = vec4(0.0, 0.0, 0.0, 0.0);
    float ofs = 0.8*time/1000.0;
    cloudColor += pow(0.5, 1.0)*texture(sampler1, texcoord + vec2(0.1, 0.1)*ofs);
    cloudColor += pow(0.5, 2.0)*texture(sampler2, texcoord + vec2(-0.2, 0)*ofs);
    cloudColor += pow(0.5, 3.0)*texture(sampler3, texcoord + vec2(0, -0.25)*ofs);
    cloudColor += pow(0.5, 4.0)*texture(sampler4, texcoord + vec2(-0.3, 0.3)*ofs);
    cloudColor = pow(cloudColor, vec4(1.0, 1.0, 1.0, 1.0) * 1.5);
//     const float a = 0.3;
//     const float b = 0.7;
//     cloudColor = clamp(cloudColor / (b-a) - a/(b-a), 0.0, 1.0);
    fragColor = mix(bgColor, fgColor, cloudColor);
    fragColor.a = 1.0;
//    fragColor += vec4(cloudColor.r, cloudColor.g, cloudColor.b, 0.0);
//    fragColor.a = 0;

//     float c = mod(time / 10000.0, 1.0);
//     fragColor = vec4(c, c, c, 1);
}