using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;
using System.Windows.Forms;

static class LightTray {
  static string Suffix = WindowsIdentity.GetCurrent().User.Value + (Environment.GetEnvironmentVariable("SHIGUANG_HELPER_TEST") ?? "");
  static string StopName = "Local\\ShiguangTrayStop-" + Suffix;
  static string StoppedName = "Local\\ShiguangTrayStopped-" + Suffix;
  [STAThread] static void Main(string[] args) {
    if (Array.IndexOf(args,"--stop") >= 0) {
      try { using(var stopped=EventWaitHandle.OpenExisting(StoppedName)) using(var stop=EventWaitHandle.OpenExisting(StopName)) { stop.Set();stopped.WaitOne(2500); } } catch(WaitHandleCannotBeOpenedException) {}
      return;
    }
    if(Array.IndexOf(args,"--handoff")<0) {
      string expected=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"拾光.exe");
      foreach(var process in Process.GetProcessesByName("拾光")) {
        try { if(String.Equals(process.MainModule.FileName,expected,StringComparison.OrdinalIgnoreCase))return; } catch {}
        finally { process.Dispose(); }
      }
    }
    bool created;
    using(var mutex=new Mutex(true,"Local\\ShiguangLightTray-"+Suffix,out created)) {
      if(!created) { Console.WriteLine("READY");return; }
      Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
      using(var context=new TrayContext()) { Console.WriteLine("READY");Application.Run(context); }
    }
  }
  sealed class TrayContext : ApplicationContext {
    NotifyIcon icon; HotKeyWindow hotkey; System.Windows.Forms.Timer timer;
    EventWaitHandle stop,stopped; RegisteredWaitHandle waiting; SynchronizationContext sync;
    public TrayContext() {
      sync=new WindowsFormsSynchronizationContext();SynchronizationContext.SetSynchronizationContext(sync);
      stopped=new EventWaitHandle(false,EventResetMode.ManualReset,StoppedName);
      stop=new EventWaitHandle(false,EventResetMode.AutoReset,StopName);
      string exe=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"拾光.exe");
      string ico=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"拾光.ico");
      icon=new NotifyIcon { Text="拾光 · 随手存，好好找",Icon=File.Exists(ico)?new Icon(ico):SystemIcons.Application,Visible=true };
      var menu=new ContextMenuStrip();menu.Items.Add("打开拾光",null,(s,e)=>Launch(false));menu.Items.Add("收藏剪贴板",null,(s,e)=>Launch(true));menu.Items.Add(new ToolStripSeparator());menu.Items.Add("退出拾光",null,(s,e)=>ExitThread());icon.ContextMenuStrip=menu;
      icon.MouseClick+=(s,e)=>{if(e.Button==MouseButtons.Left)Launch(false);};
      hotkey=new HotKeyWindow(()=>Launch(true));
      timer=new System.Windows.Forms.Timer { Interval=1000 };timer.Tick+=(s,e)=>{if(hotkey.Register())timer.Stop();};if(!hotkey.Register())timer.Start();
      waiting=ThreadPool.RegisterWaitForSingleObject(stop,(state,timedOut)=>sync.Post(_=>ExitThread(),null),null,-1,true);
    }
    void Launch(bool capture) {
      try {
        hotkey.Unregister();icon.Visible=false;
        var info=new ProcessStartInfo(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"拾光.exe"),capture?"--capture":"") { UseShellExecute=false,WorkingDirectory=AppDomain.CurrentDomain.BaseDirectory };
        Process.Start(info);ExitThread();
      } catch(Exception e) { icon.Visible=true;hotkey.Register();icon.ShowBalloonTip(4000,"无法打开拾光",e.Message,ToolTipIcon.Error); }
    }
    protected override void ExitThreadCore() {
      if(timer!=null)timer.Stop();if(hotkey!=null)hotkey.Unregister();if(icon!=null)icon.Visible=false;stopped.Set();base.ExitThreadCore();
    }
    protected override void Dispose(bool disposing) {
      if(disposing) { if(waiting!=null)waiting.Unregister(null);if(timer!=null)timer.Dispose();if(hotkey!=null)hotkey.DestroyHandle();if(icon!=null)icon.Dispose();if(stop!=null)stop.Dispose();if(stopped!=null)stopped.Dispose(); }
      base.Dispose(disposing);
    }
  }
  sealed class HotKeyWindow : NativeWindow {
    [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd,int id,uint modifiers,uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd,int id);
    Action action;bool registered;
    public HotKeyWindow(Action callback) { action=callback;CreateHandle(new CreateParams { Parent=new IntPtr(-3) }); }
    public bool Register() { if(!registered)registered=RegisterHotKey(Handle,19783,0x4003,0x53);return registered; }
    public void Unregister() { if(registered)UnregisterHotKey(Handle,19783);registered=false; }
    protected override void WndProc(ref Message m) { if(m.Msg==0x312)action();base.WndProc(ref m); }
  }
}
