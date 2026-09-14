// Illustrative, direction-anchored deep sky shared by the scene and lensed rays.
// Three-dimensional noise avoids longitude seams and pole discontinuities.
export const GALACTIC_SKY_GLSL = `
float skyHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float skyNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(skyHash(i),skyHash(i+vec3(1,0,0)),f.x),mix(skyHash(i+vec3(0,1,0)),skyHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(skyHash(i+vec3(0,0,1)),skyHash(i+vec3(1,0,1)),f.x),mix(skyHash(i+vec3(0,1,1)),skyHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float skyCloud(vec3 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*skyNoise(p);p=p*2.03+vec3(7.1,3.4,9.2);a*=.5;}return n;}
vec3 sky(vec3 direction){
 vec3 d=normalize(direction);
 float cloud=skyCloud(d*7.);
 float detail=skyCloud(d*26.+12.);
 float latitude=dot(d,normalize(vec3(.32,.82,.47)));
 float band=exp(-pow((latitude+(cloud-.5)*.22)/.19,2.));
 float core=pow(max(0.,dot(d,normalize(vec3(-.3,.25,-1.)))),8.);
 float dust=smoothstep(.34,.64,detail)*exp(-pow(latitude/.065,2.));
 vec3 color=mix(vec3(.009,.014,.034),vec3(.029,.013,.047),cloud);
 vec3 nebula=mix(vec3(.075,.14,.25),vec3(.24,.075,.20),smoothstep(.3,.7,cloud));
 color+=band*nebula*(.3+cloud*1.2)*(1.-dust*.88);
 color+=band*core*vec3(.24,.18,.12)*(1.-dust*.93);
 // Small spiral galaxies on fixed sky directions, with elliptical disks and warm cores.
 for(int i=0;i<4;i++){
  float fi=float(i);
  vec3 axis=normalize(vec3(sin(fi*2.4+.6),.25+.3*sin(fi+1.),cos(fi*2.4+.6)));
  vec3 right=normalize(cross(axis,vec3(0,1,0))),up=cross(right,axis);
  vec2 p=vec2(dot(d,right),dot(d,up)*2.3)/( .027+fi*.009);
  float r=length(p),a=atan(p.y,p.x);
  float arms=pow(.5+.5*cos(a*2.-r*4.),3.);
  float galaxy=exp(-r*1.7)*(.3+arms*.7)*step(.95,dot(d,axis));
  color+=galaxy*mix(vec3(.23,.32,.58),vec3(.9,.62,.32),exp(-r*5.));
 }
 vec2 q=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5)*vec2(1100.,550.);
 vec2 cell=floor(q);float h=skyHash(vec3(cell,1.));
 vec2 f=fract(q)-vec2(.15+.7*skyHash(vec3(cell,2.)),.15+.7*skyHash(vec3(cell,3.)));
 float width=max(.03,min(.45,length(fwidth(q))*.4));
 float star=(1.-smoothstep(.025,.025+width,length(f)))*step(.981-band*.014,h);
 float twinkle=.78+.22*sin(time*.65+h*700.);
 return color+star*twinkle*mix(vec3(.55,.72,1.),vec3(1.,.78,.48),skyHash(vec3(cell,4.)));
}
`;
