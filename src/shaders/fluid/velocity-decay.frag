precision highp float;

uniform sampler2D velocity;
varying vec2 texelCoord;

void main(){
    vec2 v = texture2D(velocity, texelCoord).xy * 0.999;
    gl_FragColor = vec4(v, 0.0, 1.0);
}
