#version 100

precision highp float;

varying vec2 uv;
varying vec3 pos;
varying vec3 norm;

uniform float time;
uniform vec4 color;

void main() {
    vec3 light = vec3(0, sin(time*1e-1), cos(time*1e-1));
//     gl_FragColor = vec4(color.xyz*dot(normalize(norm), pos), 1.0);
    float l = 0.2 + dot(normalize(norm), normalize(light));
    gl_FragColor = vec4(l*color.xyz, 1.0);
}