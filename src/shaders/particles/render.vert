uniform sampler2D particleData;
uniform vec3 uColorSlow;
uniform vec3 uColorFast;
uniform vec3 uColorHighlight;
attribute vec2 particleUV;
varying vec4 color;

void main(){
    vec2 p = texture2D(particleData, particleUV).xy;
    vec2 v = texture2D(particleData, particleUV).zw;

    gl_PointSize = 1.0;
    gl_Position = vec4(p, 0.0, 1.0);

    float speed = length(v);
    float x = clamp(speed * 4.0, 0.0, 1.0);
    color.rgb = mix(uColorSlow, uColorFast, x) + uColorHighlight * x * x * x * 0.1;
    color.a = 1.0;
}
