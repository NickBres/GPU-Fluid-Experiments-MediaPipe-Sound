precision highp float;

uniform sampler2D dye;
uniform vec3 uDecay;
varying vec2 texelCoord;

void main(){
    vec4 c = texture2D(dye, texelCoord);
    gl_FragColor = vec4(c.rgb * uDecay, 1.0);
}
