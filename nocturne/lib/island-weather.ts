import * as THREE from 'three';

/** A broad single lightning pulse, with a long quiet interval between storms. */
export function stormFlash(time: number) {
  const phase = (((time - 6) % 27) + 27) % 27;
  return phase < 0.7 ? Math.sin((Math.PI * phase) / 0.7) ** 2 : 0;
}

const cloudNoise = `
float whash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float wnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(whash(i),whash(i+vec2(1.,0.)),f.x),mix(whash(i+vec2(0.,1.)),whash(i+1.),f.x),f.y);}
float cloudFbm(vec2 p){float result=0.,weight=.53;for(int i=0;i<5;i++){result+=wnoise(p)*weight;p=mat2(1.6,1.2,-1.2,1.6)*p+3.1;weight*=.49;}return result;}`;

export function createIslandWeather(
  scene: THREE.Scene,
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
) {
  const own = <T extends { dispose: () => void }>(resource: T) => {
    resources.add(resource);
    return resource;
  };
  const time = { value: 0 },
    flash = { value: 0 };
  const skyMaterial = own(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { weatherTime: time, lightning: flash, skyImage: { value: null }, hasSkyImage: { value: false } },
      vertexShader:
        'varying vec3 skyRay;void main(){skyRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform float weatherTime;uniform float lightning;uniform sampler2D skyImage;uniform bool hasSkyImage;varying vec3 skyRay;${cloudNoise}
void main(){
  vec3 ray=normalize(skyRay);
  vec2 p=ray.xz/(abs(ray.y)+.38)*3.1;
  vec2 drift=vec2(weatherTime*.061,weatherTime*.024);
  float warp=cloudFbm(p*.53+drift*.38);
  float high=cloudFbm(p+drift+warp*1.2);
  float low=cloudFbm(p*1.7+vec2(weatherTime*.096,weatherTime*.036));
  float billow=high*.73+low*.27;
  float density=smoothstep(.28,.74,billow);
  vec3 moonRay=normalize(vec3(-.14,.37,-1.));
  float moonDistance=length(ray-moonRay);
  float lunarDisc=1.-smoothstep(.033,.035,moonDistance);
  float halo=exp(-moonDistance*8.)*.36;
  float crater=cloudFbm(ray.xz*120.)*.38+.62;
  vec3 clearSky=mix(vec3(.035,.065,.09),vec3(.012,.025,.047),smoothstep(-.15,.7,ray.y));
  clearSky+=vec3(.29,.4,.52)*halo+vec3(.92,.96,1.)*lunarDisc*crater*2.3;
  float silver=pow(max(0.,1.-moonDistance*.65),5.);
  float edge=clamp((cloudFbm(p+drift+vec2(.14,.07))-high)*5.+.35,0.,1.);
  vec3 cloudColor=mix(vec3(.018,.031,.047),vec3(.24,.32,.4),edge*(.26+silver*.74));
  cloudColor+=vec3(.3,.4,.55)*lightning*(.25+density*.6);
  vec3 color=mix(clearSky,cloudColor,density*.96);
  float closeLayer=smoothstep(.50,.77,low)*.43;
  color=mix(color,vec3(.024,.038,.05),closeLayer);
  float horizon=smoothstep(-.14,.08,ray.y);
  color=mix(vec3(.028,.052,.072),color,horizon);
  if(hasSkyImage){
    vec2 uv=vec2(fract(atan(ray.z,ray.x)/6.2831853+.54),asin(clamp(ray.y,-1.,1.))/3.14159265+.5);
    // Keep the detailed lunar disc fixed while cloud banks move independently.
    vec2 moonUV=vec2(.328,.656);
    float moonRegion=length((uv-moonUV)*vec2(2.,1.));
    vec2 wind=vec2(weatherTime*.00085, sin(weatherTime*.017)*.002);
    vec2 cloudUV=uv+wind+vec2(warp-.5,low-.5)*.003;
    cloudUV.x=fract(cloudUV.x);
    vec3 photograph=texture2D(skyImage,cloudUV).rgb;
    // Fill the source disc with neighboring cloud before advection. Never warp
    // UVs around a fixed moon: over time that folds the image into a vortex.
    float sourceMoon=1.-smoothstep(.015,.045,length((cloudUV-moonUV)*vec2(2.,1.)));
    vec3 cloudFill=texture2D(skyImage,cloudUV+vec2(0.,.065)).rgb;
    photograph=mix(photograph,cloudFill,sourceMoon);
    float disc=1.-smoothstep(.012,.0135,moonRegion);
    vec3 lunarDetail=texture2D(skyImage,uv).rgb;
    photograph+=vec3(.055,.07,.09)*exp(-moonRegion*45.);
    photograph=mix(photograph,lunarDetail,disc);
    float foreground=smoothstep(.43,.73,billow)*.72;
    vec3 silverCloud=mix(vec3(.022,.035,.055),vec3(.15,.20,.27),edge);
    color=mix(photograph*(.92+low*.12),silverCloud,foreground);
    color+=vec3(.12,.16,.22)*lightning*(.5+density*.5);
    color=mix(vec3(.0203,.0307,.0437),color,smoothstep(-.035,.15,ray.y));
  }
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  const sky = new THREE.Mesh(
    own(new THREE.SphereGeometry(900, 40, 24)),
    skyMaterial,
  );
  sky.name = 'Live storm cloud layers';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // All streaks move on the GPU. Their volume follows the viewer during exploration.
  let seed = 1241;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const count = mobile ? 420 : 1050;
  const positions = new Float32Array(count * 6),
    seeds = new Float32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = random() * 140,
      y = random() * 90,
      z = random() * 140;
    for (let end = 0; end < 2; end++) {
      const j = i * 6 + end * 3;
      positions[j] = end * -0.35;
      positions[j + 1] = end * 1.6;
      seeds.set([x, y, z], j);
    }
  }
  const rainGeometry = own(new THREE.BufferGeometry());
  rainGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  rainGeometry.setAttribute('rainSeed', new THREE.BufferAttribute(seeds, 3));
  const rainMaterial = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { weatherTime: time, lightning: flash },
      vertexShader: `attribute vec3 rainSeed;uniform float weatherTime;varying float fade;varying vec3 rainWorld;
void main(){vec3 p=position+vec3(mod(rainSeed.x+weatherTime*8.,140.)-70.,mod(rainSeed.y-weatherTime*(29.+mod(rainSeed.x,8.)),90.)-35.,rainSeed.z-70.);vec4 world=modelMatrix*vec4(p,1.);rainWorld=world.xyz;vec4 view=modelViewMatrix*vec4(p,1.);fade=(1.-position.y/1.8)*smoothstep(0.,7.,-view.z)*(1.-smoothstep(35.,80.,-view.z));gl_Position=projectionMatrix*view;}`,
      fragmentShader: `uniform float lightning;varying float fade;varying vec3 rainWorld;
void main(){if(rainWorld.y < -11.8)discard;gl_FragColor=vec4(vec3(.57,.7,.79)+lightning*.18,fade*.22);}`,
    }),
  );
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
  rain.name = 'Wind-driven rain';
  rain.frustumCulled = false;
  scene.add(rain);

  const boltPoints: THREE.Vector3[] = [];
  let last = new THREE.Vector3(-82, 117, -170);
  for (let i = 1; i <= 12; i++) {
    const next = new THREE.Vector3(
      -82 + (random() - 0.5) * 14,
      117 - i * 8.5,
      -170 + random() * 7,
    );
    boltPoints.push(last.clone(), next.clone());
    if (i === 4 || i === 7)
      boltPoints.push(
        next.clone(),
        next.clone().add(new THREE.Vector3(-14, -15, 4)),
      );
    last = next;
  }
  const boltMaterial = own(
    new THREE.LineBasicMaterial({
      color: 0xc2d7ef,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const bolt = new THREE.LineSegments(
    own(new THREE.BufferGeometry().setFromPoints(boltPoints)),
    boltMaterial,
  );
  bolt.name = 'Distant lightning';
  scene.add(bolt);
  const lightning = new THREE.DirectionalLight(0xa5c2e4, 0);
  lightning.position.set(-80, 90, -110);
  scene.add(lightning);
  function update(seconds: number, camera?: THREE.Camera) {
    time.value = seconds;
    flash.value = stormFlash(seconds);
    boltMaterial.opacity = flash.value * 0.85;
    bolt.visible = flash.value > 0;
    lightning.intensity = flash.value * 1.8;
    if (camera) {
      sky.position.copy(camera.position);
      rain.position.copy(camera.position);
    }
  }
  update(0);
  return { update, sky, rain, bolt, lightning, time,
    setSkyTexture(texture: THREE.Texture) {
      skyMaterial.uniforms.skyImage.value = texture;
      skyMaterial.uniforms.hasSkyImage.value = true;
    },
  };
}
