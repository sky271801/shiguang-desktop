# 拾光 · 别再把收藏藏进聊天记录

Remotion 互动预览项目，1920×1080 横屏、60fps、40 秒，音乐和字幕，无旁白。

启动：`npm run dev -- --port=3016`

主时间线：[Shiguang](http://localhost:3016/Shiguang)。点击播放，音量可在 Studio 工具栏调节。左侧 Scenes 文件夹可单独打开七个场景；主时间线中的片段可以拖动与调整时长，选中场景可修改标题和说明文字。`BRIEF.md` 记录故事结构。

画面：微信自己的聊天窗口为场景演绎；程序截图通过 `capture-assets.cjs` 从隔离示例库生成，没有使用真实用户收藏。`public/diagram.png` 为自行绘制的数学示意图。

声音：`make_music.py` 生成的原创器乐与短提示音，素材不含第三方歌曲和人声。重新生成：`python make_music.py`。

已导出成片：`output/拾光-宣传片-1080p60.mp4`，40 秒、1920×1080、60fps，H.264 / AAC，约 12.5 MiB。保留可调整的 Studio 预览。导出检查已核对完整 2400 帧、时长与音轨，并完整解码通过；记录在 `qa/export-metadata.json` 与 `qa/export-decode.log`。
