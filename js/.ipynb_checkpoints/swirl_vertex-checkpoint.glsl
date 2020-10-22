#version 300 es

precision mediump float;

uniform mat4 projectionMatrix;

in vec4 position;
in vec2 uv;

out mediump vec2 texcoord;

void main() {
    gl_Position = projectionMatrix * position;
    texcoord = uv;
}

