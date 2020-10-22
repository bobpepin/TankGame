#version 100

precision highp float;

uniform mat4 projectionMatrix;
uniform mat4 worldMatrix;

attribute vec4 position;

void main() {
    gl_Position = projectionMatrix * worldMatrix * position;
}

