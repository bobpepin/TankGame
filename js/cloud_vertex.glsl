#version 300 es

precision highp float;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

uniform float time;

in vec3 position;
in vec2 uv;

out vec2 texcoord;

void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    texcoord = uv;
}
