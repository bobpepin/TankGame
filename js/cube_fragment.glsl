#version 300 es

precision highp float;

uniform vec3 color;

in vec2 texcoord;
in vec3 direction;
uniform samplerCube sampler;

out vec4 fragColor;

void main() {
    fragColor = texture(sampler, direction);
    fragColor.a = 1.0;
}