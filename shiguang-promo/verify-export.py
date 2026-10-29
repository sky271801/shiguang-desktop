from pathlib import Path
import json, subprocess, wave, numpy as np
root=Path(__file__).resolve().parent
video=root/'output'/'拾光-宣传片-1080p60.mp4'
bin_dir=root/'node_modules'/'@remotion'/'compositor-win32-x64-msvc'
probe=subprocess.run([str(bin_dir/'ffprobe.exe'),'-v','error','-show_streams','-show_format','-of','json',str(video)],capture_output=True,text=True,encoding='utf-8',check=True)
meta=json.loads(probe.stdout)
v=next(s for s in meta['streams'] if s['codec_type']=='video')
a=next(s for s in meta['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'])==(1920,1080)
assert v['r_frame_rate']=='60/1'
assert int(v['nb_frames'])==2400
assert abs(float(meta['format']['duration'])-40)<.1
assert v['codec_name']=='h264' and v['pix_fmt']=='yuv420p'
assert a['codec_name']=='aac' and a['channels']==2
qa=root/'qa';qa.mkdir(exist_ok=True)
(qa/'export-metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
# Decode the entire file and measure the music level to catch corrupt frames / silence.
decode=subprocess.run([str(bin_dir/'ffmpeg.exe'),'-hide_banner','-i',str(video),'-c:v','rawvideo','-c:a','pcm_s16le','-f','null','NUL'],capture_output=True,text=True,encoding='utf-8',errors='replace')
if decode.returncode:raise RuntimeError(decode.stderr[-4000:])
(qa/'export-decode.log').write_text(decode.stderr,encoding='utf-8')
subprocess.run([str(bin_dir/'ffmpeg.exe'),'-v','error','-i',str(video),'-vn','-c:a','pcm_s16le','-y',str(qa/'export-audio.wav')],capture_output=True,check=True)
with wave.open(str(qa/'export-audio.wav'),'rb') as w:sound=w.readframes(w.getnframes())
samples=np.frombuffer(sound,dtype='<i2').astype(float)/32768
peak=float(np.max(np.abs(samples)));rms=float(np.sqrt(np.mean(samples**2)))
assert .01<peak<1 and rms>.001
# Inspect representative frames from the encoded MP4, rather than Studio.
for i,second in enumerate([5,13,20,30.8,38.5],1):
 frames=subprocess.run([str(bin_dir/'ffmpeg.exe'),'-hide_banner','-loglevel','error','-ss',str(second),'-i',str(video),'-frames:v','1','-vf','scale=960:-1','-c:v','png','-y',str(qa/f'export-{i:02d}.png')],capture_output=True,text=True,encoding='utf-8',errors='replace')
 if frames.returncode:raise RuntimeError(frames.stderr)
print(json.dumps({'file':str(video),'seconds':meta['format']['duration'],'resolution':[v['width'],v['height']],'fps':v['r_frame_rate'],'frames':v['nb_frames'],'video':v['codec_name'],'audio':a['codec_name'],'sizeMB':round(video.stat().st_size/1024/1024,2),'fullDecode':'passed'},ensure_ascii=False))
print(json.dumps({'audioPeak':round(peak,4),'audioRMS':round(rms,4)}))
