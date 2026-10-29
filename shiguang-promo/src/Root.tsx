import {Composition,Folder} from 'remotion';
import {Promo} from './Composition';
import {Hook} from './Hook';import {Clutter} from './Clutter';import {Lost} from './Lost';import {Reveal} from './Reveal';import {Capture} from './Capture';import {Find} from './Find';import {Finale} from './Finale';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Shiguang" component={Promo} durationInFrames={2400} fps={60} width={1920} height={1080}/>
      <Folder name="Scenes">
       <Composition id="Chat" component={Hook} durationInFrames={378} fps={60} width={1920} height={1080} defaultProps={{title:'好东西，\n先发给自己。',subtitle:'打开微信，找到自己。\n文字、截图、PDF，顺手一发。'}}/>
       <Composition id="Clutter" component={Clutter} durationInFrames={318} fps={60} width={1920} height={1080} defaultProps={{title:'「先存着」\n越来越多。',subtitle:'聊天框，慢慢变成了\n没有目录的收藏夹。'}}/>
       <Composition id="Lost" component={Lost} durationInFrames={258} fps={60} width={1920} height={1080} defaultProps={{title:'存下来了，\n却找不到了。',subtitle:'上次那份资料，到底发在哪一天？'}}/>
       <Composition id="Reveal" component={Reveal} durationInFrames={198} fps={60} width={1920} height={1080} defaultProps={{title:'给零散的好内容，\n一个专属的位置。',subtitle:'于是，有了拾光。'}}/>
       <Composition id="Capture" component={Capture} durationInFrames={558} fps={60} width={1920} height={1080} defaultProps={{title:'直接粘贴。\n已经收好。',subtitle:'保留原来的顺手，\n多一个清楚的位置。'}}/>
       <Composition id="Find" component={Find} durationInFrames={438} fps={60} width={1920} height={1080} defaultProps={{title:'想用的时候，一搜就到。',subtitle:'标题、正文、文件名和标签，都可以搜。'}}/>
       <Composition id="Finale" component={Finale} durationInFrames={360} fps={60} width={1920} height={1080} defaultProps={{title:'别再把收藏，\n藏进聊天记录里。',subtitle:'随手一贴，即刻收藏。'}}/>
      </Folder>
    </>
  );
};
