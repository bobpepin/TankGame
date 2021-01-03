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
    fragColor = vec4(color.r, color.g, color.b, 1.0);
    vec4 cloudColor = vec4(0.0, 0.0, 0.0, 0.0);
    float ofs = time/1000.0;
    cloudColor += pow(0.5, 1.0)*texture(sampler1, texcoord + vec2(0.1, 0.1)*ofs);
    cloudColor += pow(0.5, 2.0)*texture(sampler2, texcoord + vec2(-0.2, 0)*ofs);
    cloudColor += pow(0.5, 3.0)*texture(sampler3, texcoord + vec2(0, -0.25)*ofs);
    cloudColor += pow(0.5, 4.0)*texture(sampler4, texcoord + vec2(-0.3, 0.3)*ofs); 
    fragColor += pow(cloudColor, vec4(1.0, 1.0, 1.0, 1.0) * 2.0);
//     float c = mod(time / 10000.0, 1.0);
//     fragColor = vec4(c, c, c, 1);
}