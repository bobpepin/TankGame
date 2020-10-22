#version 100

precision highp float;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

attribute vec3 position;
attribute vec2 texcoord;

varying vec2 uv;

void main() {
    gl_Position = projectionMatrix * worldMatrix * vec4(position, 1.0);
    uv = texcoord;
}
