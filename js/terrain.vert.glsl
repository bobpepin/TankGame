#version 100

precision highp float;

uniform mat4 projectionMatrix;
// uniform mat4 worldMatrix;
// uniform mat4 nodeMatrix;

// uniform vec4 color;

// uniform float time;


attribute vec3 position;
attribute vec3 normal;
attribute vec2 texcoord;

varying vec2 uv;
varying vec3 norm;
varying vec3 pos;

void main() {
    gl_Position = projectionMatrix * vec4(position, 1.0);
//     gl_Position = vec4(position, 1.0);
    uv = texcoord;
    pos = position;
    norm = normal;
}
