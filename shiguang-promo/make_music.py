"""Original, deterministic instrumental underscore; no third-party samples."""
from pathlib import Path
import numpy as np
import wave

sr=44100; duration=40; rng=np.random.default_rng(19)
audio=np.zeros((sr*duration,2),dtype=np.float64)
def add(sound,start,gain=.2,pan=0):
    idx=int(start*sr)
    if idx>=len(audio):return
    sound=sound[:len(audio)-idx]*gain
    audio[idx:idx+len(sound),0]+=sound*np.sqrt((1-pan)/2)
    audio[idx:idx+len(sound),1]+=sound*np.sqrt((1+pan)/2)
def note(midi,seconds=1.1,soft=False):
    t=np.arange(int(seconds*sr))/sr;f=440*2**((midi-69)/12)
    env=(1-np.exp(-t*(35 if soft else 150)))*np.exp(-t*(1.6 if soft else 4.5))
    return (np.sin(2*np.pi*f*t+1.4*np.sin(2*np.pi*f*2*t)*np.exp(-t*7))+.18*np.sin(2*np.pi*f*3*t))*env
def kick():
    t=np.arange(int(.35*sr))/sr
    return np.sin(2*np.pi*(48*t+4*(1-np.exp(-t*24))))*np.exp(-t*14)
def hat():
    t=np.arange(int(.09*sr))/sr;n=rng.normal(size=len(t));return (n-np.roll(n,1))*.28*np.exp(-t*55)
def snare():
    t=np.arange(int(.18*sr))/sr;return (.5*rng.normal(size=len(t))+.3*np.sin(2*np.pi*180*t))*np.exp(-t*24)

# Quiet, slightly suspended opening: the repeated action of saving to chat.
for i,start in enumerate([1.2,2.5,4.0,6.3,7.4,8.5,9.6,10.5]):
    add(note([74,77,81,76][i%4],.75),start,.1,(-1)**i*.35)
for start in np.arange(6,11,.4):add(note(50,.4),start,.07)
add(note(55,3.5,True),11.1,.15,-.2);add(note(62,3.5,True),11.1,.1,.2)

# A clean harmonic release when the product appears, then a steady useful groove.
bpm=120;beat=60/bpm;chords=[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,69]]
melody=[0,2,1,3,2,1,2,3]
for bar,start in enumerate(np.arange(15,40,beat*4)):
    chord=chords[bar%4]
    for j,m in enumerate(chord):add(note(m,3.4,True),start,.13,(-.65+j*.42))
    for step in range(8):
        at=start+step*beat/2
        add(note(chord[melody[step]]+12,.8),at,.085 if at<18 else .12,(-.45 if step%2 else .45))
    if start>=17:
        for step in [0,2]:add(kick(),start+step*beat,.3)
        for step in [1,3]:add(snare(),start+step*beat,.085)
        for step in range(8):add(hat(),start+step*beat/2,.045,-.2 if step%2 else .2)
        for step in [0,1.5,2,3.5]:add(note(chord[0]-24,.45),start+step*beat,.19)

# Small original UI accents at capture beats.
for start in [19.2,22.4,24.9,29.0,32.2,36.1]:
    add(note(84,.22),start,.065,-.1);add(note(91,.28),start+.07,.045,.2)
# A soft stereo space, not a long wash that masks the punctuation.
dry=audio.copy()
for delay,gain in [(.113,.12),(.227,.075)]:
    offset=int(delay*sr);audio[offset:]+=dry[:-offset,::-1]*gain
t=np.arange(len(audio))/sr;fade=np.minimum(1,t/.8)*np.minimum(1,np.maximum(0,(duration-t)/1.8))
audio*=fade[:,None];audio=np.tanh(audio*1.25)
audio*=.77/max(.01,np.max(np.abs(audio)))
dest=Path(__file__).parent/'public'/'music.wav'
with wave.open(str(dest),'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((audio*32767).astype('<i2').tobytes())
print(f'Original instrumental: {duration}s, stereo, {dest.name}')
