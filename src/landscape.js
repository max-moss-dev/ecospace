import * as THREE from 'three';
import { at, ground, randomGenerator, shore, shoreX } from './site.js';

const sun = new THREE.Vector3(0.16, 0.48, -0.86).normalize();
const sunset = new THREE.Vector3(-0.65, 0.09, -0.63).normalize();
const atmospheric = `
  uniform float dusk;
  uniform vec3 sunDirection;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  vec3 skyColor(vec3 direction) {
    float h = clamp(direction.y, 0.0, 1.0);
    vec3 horizon = mix(vec3(0.58,0.76,0.77), vec3(0.71,0.36,0.25), dusk);
    vec3 zenith = mix(vec3(0.19,0.45,0.55), vec3(0.07,0.14,0.27), dusk);
    vec3 color = mix(horizon, zenith, pow(h, 0.49));
    float solar = max(dot(direction, sunDirection), 0.0);
    color += pow(solar, 12.0) * mix(vec3(.21,.18,.11),vec3(.61,.30,.12),dusk) * (1.0-h*0.45);
    color += smoothstep(.99991,.99997,solar) * vec3(2.7,1.9,1.08);
    return color;
  }
`;

export function addLandscape(scene) {
  const mood = { value: 0 };
  const time = { value: 0 };
  const sunDirection = { value: sun.clone() };
  const uniforms = { dusk: mood, time, sunDirection };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(860, 28, 18), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms,
    vertexShader: `
      varying vec3 world;
      void main(){ world=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec3 world;
      ${atmospheric}
      void main(){
        vec3 ray=normalize(world);
        vec3 color=skyColor(ray);
        vec2 p=ray.xz/max(0.18,ray.y+0.10);
        float cloud=noise(p*2.3)+noise(p*5.6)*.45+noise(p*12.7)*.16;
        float sheet=smoothstep(.69,1.04,cloud)*smoothstep(.014,.16,ray.y)*(1.0-smoothstep(.50,.82,ray.y));
        color=mix(color,mix(vec3(.87,.86,.73),vec3(.76,.47,.35),dusk),sheet*.46);
        gl_FragColor=vec4(color,1);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(1540, 1540), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 world;
      void main(){ world=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0); }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 world;
      ${atmospheric}
      void main(){
        vec3 eye=normalize(cameraPosition-world);
        vec2 p=world.xz;
        float dist=length(cameraPosition-world);
        float fade=1.0-smoothstep(35.0,205.0,dist);
        float w1=dot(p,vec2(.44,1.2))+time*1.38+noise(p*.17)*5.8+noise(p*.43)*1.25;
        float w2=dot(p,vec2(-.91,2.06))-time*.89+noise(p*.31+vec2(8.,3.))*3.0;
        float w3=dot(p,vec2(4.1,3.8))+time*1.65;
        vec3 normal=normalize(vec3((cos(w1)*.082+cos(w2)*.048+cos(w3)*.019*fade),1.,
          (sin(w1)*.13+sin(w2)*.048+sin(w3)*.022*fade)));
        vec3 reflected=reflect(-eye,normal);
        float fresnel=pow(1.0-max(dot(eye,normal),0.0),3.0);
        vec3 base=mix(vec3(.065,.22,.20),vec3(.035,.07,.10),dusk);
        vec3 color=mix(base,skyColor(reflected),.19+.48*fresnel);
        float glint=pow(max(dot(reflected,sunDirection),0.0),94.0+dist*.16);
        color+=glint*mix(vec3(.63,.54,.37),vec3(1.15,.52,.20),dusk);
        color+=cos(w2+w3*.11)*.021*fade;
        color=mix(color,skyColor(vec3(0.,0.,1.)),smoothstep(170.,650.,dist)*.48);
        gl_FragColor=vec4(color,1);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(145, 0, 80);
  scene.add(water);

  scene.add(makeTerrain());
  addRocks(scene);
  addTrees(scene);
  addGroundCover(scene);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(470, 2.2, 19),
    new THREE.MeshBasicMaterial({ color: 0x8da99a, fog: true }));
  ridge.position.set(218, 0.45, -274);
  ridge.rotation.y = -0.05;
  scene.add(ridge);

  return {
    update(seconds, amount) {
      time.value = seconds;
      mood.value = amount;
      sunDirection.value.copy(sun).lerp(sunset, amount).normalize();
    },
  };
}

function makeTerrain() {
  const edgeOffsets = [-3, 0, 2, 4, 6, 9, 12, 16, 21, 29, 39, 52, 68, 90, 125, 180, 260, 360];
  const positions = [];
  const colors = [];
  const indices = [];
  const sand = new THREE.Color(0xafa07a);
  const clay = new THREE.Color(0x756c53);
  const grass = new THREE.Color(0x637d3a);
  const field = new THREE.Color(0x84935a);
  const random = randomGenerator(30);
  const stations = shore.slice(1).flatMap((p, i) => {
    const from = shore[i][1];
    const count = Math.ceil((p[1] - from) / 2.5);
    return Array.from({ length: count }, (_, j) => from + (p[1] - from) * j / count);
  }).concat(shore.at(-1)[1]);
  for (const z of stations) {
    for (const distance of edgeOffsets) {
      const x = shoreX(z) - distance;
      positions.push(x, ground(x, z), z);
      const along = 0.12 * Math.sin(x * .61 + z * .36) + 0.05 * Math.cos(x + z * 0.64);
      const color = sand.clone().lerp(clay, Math.max(0, Math.min(.7, (distance - 2) / 12 + along)));
      if (distance > 5) color.lerp(grass, Math.min(1, (distance - 5) / 8));
      if (distance > 46) color.lerp(field, Math.min(1, (distance - 46) / 78));
      color.multiplyScalar(.75 + random() * .34 + along);
      colors.push(color.r, color.g, color.b);
    }
  }
  const columns = edgeOffsets.length;
  for (let row = 0; row < stations.length - 1; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const index = row * columns + col;
      const next = index + columns;
      indices.push(index, index + 1, next, index + 1, next + 1, next);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vSitePosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvSitePosition=position;');
    shader.fragmentShader = 'varying vec3 vSitePosition;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>', `#include <color_fragment>
      vec2 soil=vSitePosition.xz;
      float grain=fract(sin(dot(floor(soil*17.),vec2(127.1,311.7)))*43758.5453);
      float patches=sin(soil.x*1.17+sin(soil.y*.72))*sin(soil.y*.89-soil.x*.21);
      diffuseColor.rgb *= .9 + .19*grain + .11*patches;
    `);
  };
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function addRocks(scene) {
  const count = 420;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xddceb0, roughness: 0.99, flatShading: true }), count);
  const random = randomGenerator(824);
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let index = 0; index < count; index++) {
    const z = -14 + random() * 111;
    const x = shoreX(z) - (2.9 + random() * 7.5);
    const size = 0.11 + random() ** 2 * 0.59;
    transform.position.set(x, ground(x, z) + size * 0.2, z);
    transform.rotation.set(random(), random() * 6.28, random());
    transform.scale.set(size * (1.2 + random()), size * .56, size);
    transform.updateMatrix();
    rocks.setMatrixAt(index, transform.matrix);
    tint.setHSL(.105, .13 + random()*.13, .52 + random() * .33);
    rocks.setColorAt(index, tint);
  }
  rocks.receiveShadow = true;
  scene.add(rocks);
}

function addTrees(scene) {
  const random = randomGenerator(818);
  const locations = [];
  for (const id of ['TREES_NE', 'TREES_SW']) {
    const [cx, cz] = at(id);
    for (let i = 0; i < 17; i++) locations.push([cx + (random() - .5) * 15 - 2, cz + (random() - .5) * 18, 4 + random() * 6.8]);
  }
  for (let i = 0; i < 175; i++) {
    const z = -87 + random() * 290;
    const x = shoreX(z) - 55 - random() * 113;
    locations.push([x, z, 3.5 + random() * 10]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .23, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0x64503a, roughness: 1 }), locations.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.99, flatShading: true }), locations.length * 8);
  const form = new THREE.Object3D();
  const tone = new THREE.Color();
  locations.forEach(([x, z, h], index) => {
    const y = ground(x, z);
    form.position.set(x, y + h*.31, z);
    form.scale.set(h*.17, h*.62, h*.17);
    form.rotation.set(0, 0, (random() - .5) * .09);
    form.updateMatrix();
    trunks.setMatrixAt(index, form.matrix);
    const hue = .18 + random() * .11;
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.399;
      const offset = i === 0 ? 0 : h * (.10 + random() * .10);
      const radius = h * (.135 + random() * .11);
      form.position.set(x + Math.cos(angle) * offset, y + h * (.58 + random() * .32) + (i === 0 ? h*.11 : 0),
        z + Math.sin(angle) * offset);
      form.scale.set(radius * 1.12, radius * 1.34, radius);
      form.rotation.set(random(), angle, random() * .4);
      form.updateMatrix();
      crowns.setMatrixAt(index * 8 + i, form.matrix);
      tone.setHSL(hue + (random() - .5)*.06, .33 + random()*.21, .23 + random()*.14);
      crowns.setColorAt(index * 8 + i, tone);
    }
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  scene.add(trunks, crowns);
}

function addGroundCover(scene) {
  const random = randomGenerator(210);
  const triangles = [];
  const colors = [];
  const tone = new THREE.Color();
  for (let i = 0; i < 4500; i++) {
    const z = -19 + random() * 125;
    const offset = 4.7 + random() * 11;
    const x = shoreX(z) - offset;
    const y = ground(x, z);
    const height = .09 + random() ** 2 * .36;
    const width = .024 + random() * .06;
    const angle = random() * Math.PI;
    const a = Math.cos(angle)*width;
    const b = Math.sin(angle)*width;
    triangles.push(x-a,y,z-b,x+a,y,z+b,x+(random()-.5)*.15,y+height,z+(random()-.5)*.11);
    tone.setHSL(.13 + random()*.12, .25 + random()*.35, .21 + random()*.17);
    for (let j = 0; j < 3; j++) colors.push(tone.r, tone.g, tone.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
}
