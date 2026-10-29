import {useCurrentFrame,useVideoConfig,interpolate,staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {TransitionSeries,linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Hook} from './Hook';import {Clutter} from './Clutter';import {Lost} from './Lost';import {Reveal} from './Reveal';import {Capture} from './Capture';import {Find} from './Find';import {Finale} from './Finale';
export const Promo=()=>{const {fps}=useVideoConfig(),frame=useCurrentFrame();return <>
 <Audio name="原创器乐与界面音效" src={staticFile('music.wav')} premountFor={fps} volume={interpolate(frame,[0,.8*fps,38.2*fps,40*fps],[0,.72,.72,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
 <TransitionSeries>
  <TransitionSeries.Sequence name="01 发给自己" durationInFrames={6.3*fps} premountFor={fps}><Hook title={'好东西，\n先发给自己。'} subtitle={'打开微信，找到自己。\n文字、截图、PDF，顺手一发。'}/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="02 越攒越乱" durationInFrames={5.3*fps} premountFor={fps}><Clutter title={'「先存着」\n越来越多。'} subtitle={'聊天框，慢慢变成了\n没有目录的收藏夹。'}/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="03 存了却找不到" durationInFrames={4.3*fps} premountFor={fps}><Lost title={'存下来了，\n却找不到了。'} subtitle="上次那份资料，到底发在哪一天？"/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="04 拾光登场" durationInFrames={3.3*fps} premountFor={fps}><Reveal title={'给零散的好内容，\n一个专属的位置。'} subtitle="于是，有了拾光。"/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="05 直接粘贴即收藏" durationInFrames={9.3*fps} premountFor={fps}><Capture title={'直接粘贴。\n已经收好。'} subtitle={'保留原来的顺手，\n多一个清楚的位置。'}/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="06 想用时找回来" durationInFrames={7.3*fps} premountFor={fps}><Find title="想用的时候，一搜就到。" subtitle="标题、正文、文件名和标签，都可以搜。"/></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames:.3*fps})}/>
  <TransitionSeries.Sequence name="07 留下内容而非混乱" durationInFrames={6*fps} premountFor={fps}><Finale title={'别再把收藏，\n藏进聊天记录里。'} subtitle="随手一贴，即刻收藏。"/></TransitionSeries.Sequence>
 </TransitionSeries>
 </>;};
