precision highp float;

varying vec2 texelCoord;

void main(){
    vec2 ip = texelCoord * 2.0 - 1.0;
    gl_FragColor = vec4(ip, 0.0, 0.0);
}
