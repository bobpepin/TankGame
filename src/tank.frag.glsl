#version 100

precision highp float;

varying vec2 uv;

uniform highp sampler2D spriteSampler;
uniform float hitTime;
uniform float time;

// out vec4 fragColor;

void main() {
    vec4 fragColor;
    float omega = 4.0 * (2.0*3.14);
    fragColor = texture2D(spriteSampler, uv);
    float hit = step(time, hitTime+1.9)*abs(cos(omega*(hitTime-time)));
//    float hit = time < hitTime+5.0 ? 1.0 : 0.0;
    fragColor.rgb += hit;
    fragColor.rgb *= fragColor.a;
    gl_FragColor = fragColor;
}