#version 300 es

precision mediump float;

uniform float time;
uniform sampler2D sampler;

in vec2 texcoord;

out vec4 fragColor;

void main() {
    mediump vec4 g = texture(sampler, texcoord);
    float f = 0.5*pow(sin(g.x*3.14/2.0 + 0.5*time/1000.0), 2.0);
    f += 0.25*pow(sin(g.y*4.0*3.14 + 2.71*time/1000.0), 2.0);
    f += 0.125*pow(sin(g.x*8.0*3.14 - 13.4*time/1000.0), 2.0);
    f /= 0.825;
    fragColor = vec4(vec3(f), 1.0);
}
