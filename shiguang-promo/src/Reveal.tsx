import React from 'react';
import {CanvasImage,Interactive,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {Base,C,Caption,Eyebrow,FileGlyph,Rise,SceneProps,clamp,sceneSchema} from './shared';
const RevealInner:React.FC<SceneProps>=({title,subtitle,style})=>{const f=useCurrentFrame(),{fps}=useVideoConfig();return <Base style={style}>
 <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 35%,#E0E8FF,transparent 63%)'}}/>
 {['TXT','IMG','PDF'].map((v,i)=><div key={v} style={{position:'absolute',left:interpolate(f,[0,1.25*fps],[450+i*480,920],clamp),top:interpolate(f,[0,1.25*fps],[i===1?60:400,200],clamp),rotate:interpolate(f,[0,1.25*fps],[`${i*15-15}deg`,'0deg'],clamp),scale:interpolate(f,[0,1.25*fps],[1,.3],{...clamp,output:'perceptual-scale'}),opacity:interpolate(f,[.8*fps,1.25*fps],[1,0],clamp)}}><FileGlyph kind={v} size={90}/></div>)}
 <div style={{position:'absolute',left:850,top:110,width:220,height:220,scale:interpolate(f,[0,.9*fps,3.3*fps],[.5,1,1.08],{...clamp,output:'perceptual-scale'}),rotate:interpolate(f,[0,.9*fps],['-16deg','0deg'],clamp),opacity:interpolate(f,[0,.3*fps],[0,1],clamp)}}><CanvasImage src={staticFile('brand.svg')} style={{width:220,height:220}}/></div>
 <div style={{position:'absolute',top:385,left:120,right:120,textAlign:'center',translate:interpolate(f,[0,3.3*fps],['0px 10px','0px -10px'])}}><Rise delay={.25}><div style={{fontSize:33,letterSpacing:12,color:C.blue,fontWeight:700,marginBottom:28}}>拾光　SHIGUANG</div></Rise><Rise delay={.45}><h1 style={{fontSize:95,lineHeight:1.3,letterSpacing:-2,whiteSpace:'pre-line',margin:0}}>{title}</h1></Rise><Rise delay={1.1}><p style={{fontSize:38,color:C.muted,marginTop:34}}>{subtitle}</p></Rise></div>
 <div style={{position:'absolute',left:120,top:95}}><Eyebrow blue>把有用的，留下来</Eyebrow></div><Caption>一个为随手收藏而做的 Windows 桌面程序。</Caption>
 </Base>;};
export const Reveal=Interactive.withSchema({Component:RevealInner,componentName:'<Reveal>',schema:sceneSchema,wrapInSequence:true});
