import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// A camera-reprojected temporal upscaler. This is not the AMD FSR implementation.
// Linear HDR histories carry view depth in alpha. Dynamic objects use reactive
// rectangles; disocclusion and neighborhood clipping reject invalid history.
const fragment = `
varying vec2 vUv;
uniform sampler2D currentColor, currentDepth, historyColor;
uniform mat4 inverseProjection, cameraWorld, previousViewProjection, previousView;
uniform vec2 inputSize, jitterUV;
uniform float historyWeight, hasHistory, reactiveAll;
uniform vec4 reactiveRects[12];
vec3 toY(vec3 c){return vec3(dot(c,vec3(.25,.5,.25)),.5*c.r-.5*c.b,-.25*c.r+.5*c.g-.25*c.b);}
vec3 fromY(vec3 c){return vec3(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z);}
void main(){
 vec2 uv=clamp(vUv+jitterUV,vec2(.00001),vec2(.99999));
 vec3 current=texture2D(currentColor,uv).rgb;
 float d=texture2D(currentDepth,uv).r;
 vec4 view=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);view/=view.w;
 float linearDepth=-view.z;
 vec4 world=cameraWorld*view;
 vec4 oldClip=previousViewProjection*world;
 vec2 oldUV=oldClip.xy/max(.00001,oldClip.w)*.5+.5;
 vec4 old=texture2D(historyColor,clamp(oldUV,vec2(0.),vec2(1.)));
 float predictedDepth=-(previousView*world).z;
 float valid=hasHistory*float(oldClip.w>0. && all(greaterThanEqual(oldUV,vec2(0.))) && all(lessThanEqual(oldUV,vec2(1.))));
 valid*=float(abs(old.a-predictedDepth)<max(.012,predictedDepth*.012));
 valid*=float(d<.999999);
 vec3 lo=vec3(1e20),hi=vec3(-1e20),mean=vec3(0.),squared=vec3(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec3 c=toY(texture2D(currentColor,clamp(uv+vec2(float(x),float(y))/inputSize,vec2(0.),vec2(1.))).rgb);
   lo=min(lo,c);hi=max(hi,c);mean+=c;squared+=c*c;
 }
 mean/=9.;vec3 deviation=sqrt(max(vec3(0.),squared/9.-mean*mean));
 vec3 clipped=fromY(clamp(toY(old.rgb),max(lo,mean-deviation*1.5),min(hi,mean+deviation*1.5)));
 float reactive=reactiveAll;
 for(int i=0;i<12;i++){
   vec4 r=reactiveRects[i];
   if(r.z>r.x && r.w>r.y && all(greaterThanEqual(vUv,r.xy)) && all(lessThanEqual(vUv,r.zw)))reactive=1.;
 }
 float change=abs(toY(current).x-toY(clipped).x)/max(.1,toY(current).x);
 reactive=max(reactive,smoothstep(.12,.5,change));
 gl_FragColor=vec4(mix(current,clipped,historyWeight*valid*(1.-reactive*.92)),linearDepth);
}`;
function halton(i,base){let f=1,result=0;for(;i>0;i=Math.floor(i/base)){f/=base;result+=f*(i%base);}return result;}
export function temporalJitter(index){return [halton(index%16+1,2)-.5,halton(index%16+1,3)-.5];}

export function createTemporalUpscaler(renderer,{samples=16}={}){
 const uniforms={currentColor:{value:null},currentDepth:{value:null},historyColor:{value:null},
 inverseProjection:{value:new THREE.Matrix4()},cameraWorld:{value:new THREE.Matrix4()},
 previousViewProjection:{value:new THREE.Matrix4()},previousView:{value:new THREE.Matrix4()},
 inputSize:{value:new THREE.Vector2(1,1)},jitterUV:{value:new THREE.Vector2()},
 historyWeight:{value:0},hasHistory:{value:0},reactiveAll:{value:0},
 reactiveRects:{value:Array.from({length:12},()=>new THREE.Vector4())}};
 const material=new THREE.ShaderMaterial({name:'StudioTemporalUpscale',uniforms,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:fragment,
 depthTest:false,depthWrite:false,toneMapped:false});
 const quad=new FullScreenQuad(material),output=new OutputPass();output.renderToScreen=true;
 const options={type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter};
 let a=new THREE.WebGLRenderTarget(1,1,options),b=a.clone(),width=1,height=1,count=0,index=0,frames=0,resets=0,reason='startup';
 const projection=new THREE.Matrix4(),previousProjection=new THREE.Matrix4(),oldView=new THREE.Matrix4();
 let jittered=false;
 function invalidate(why='scene'){count=0;reason=why;resets++;}
 function resize(w,h){w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));if(w===width&&h===height)return;
   width=w;height=h;a.setSize(w,h);b.setSize(w,h);invalidate('resize');}
 function begin(camera,w,h){
   if(jittered)throw new Error('Temporal camera jitter was not restored');
   projection.copy(camera.projectionMatrix);const j=temporalJitter(index++);
   camera.projectionMatrix.elements[8]-=2*j[0]/w;camera.projectionMatrix.elements[9]-=2*j[1]/h;
   camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
   uniforms.jitterUV.value.set(j[0]/w,j[1]/h);uniforms.inputSize.value.set(w,h);
   uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
   camera.updateMatrixWorld();uniforms.cameraWorld.value.copy(camera.matrixWorld);jittered=true;
 }
 function restore(camera){if(!jittered)return;camera.projectionMatrix.copy(projection);camera.projectionMatrixInverse.copy(projection).invert();jittered=false;}
 function resolve({color,depth,camera,moving=false,reactive=false,rects=[]}){
   restore(camera);
   uniforms.currentColor.value=color;uniforms.currentDepth.value=depth;uniforms.historyColor.value=a.texture;
   uniforms.previousViewProjection.value.copy(previousProjection);uniforms.previousView.value.copy(oldView);
   uniforms.hasHistory.value=count>0?1:0;uniforms.historyWeight.value=moving ? .88 : Math.min(.95,count/(count+1));
   uniforms.reactiveAll.value=reactive?1:0;
   uniforms.reactiveRects.value.forEach((v,i)=>rects[i]?v.fromArray(rects[i]):v.set(0,0,0,0));
   const target=renderer.getRenderTarget();
   try{renderer.setRenderTarget(b);quad.render(renderer);[a,b]=[b,a];output.render(renderer,null,a);}
   finally{renderer.setRenderTarget(target);}
   previousProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);oldView.copy(camera.matrixWorldInverse);
   count=Math.min(samples,count+1);frames++;
 }
 async function warmup(){
   if(!renderer.compileAsync)return;
   const target=renderer.getRenderTarget(),s=new THREE.Scene(),g=new THREE.PlaneGeometry(2,2),c=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
   try{s.add(new THREE.Mesh(g,material));renderer.setRenderTarget(a);await renderer.compileAsync(s,c);
     let pending;output.render({outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure,
       setRenderTarget:t=>renderer.setRenderTarget(t),render:(o,c)=>{pending=renderer.compileAsync(o,c);}},null,a);await pending;
   }finally{renderer.setRenderTarget(target);g.dispose();}
 }
 return {begin,restore,resolve,resize,invalidate,warmup,
   get converged(){return count>=samples;},get texture(){return a.texture;},
   getStats:()=>({method:'camera-reprojection TAAU',width,height,frames,samples:count,targetSamples:samples,resets,reason,historyBytes:width*height*16}),
   dispose(){a.dispose();b.dispose();material.dispose();quad.dispose();output.dispose();}};
}
