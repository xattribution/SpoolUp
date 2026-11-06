// PC sounds: plays the deck's button sounds on one of this PC's outputs (a headset, say), so
// they're heard over the game. The tablet decides what each sound is and sends it as a list
// of tones; Synth renders them the way the tablet's Web Audio does (public/sound.js) and
// WinMM's waveOut plays them. Only sound comes out of here: nothing touches the game.
// Commands on stdin, one per line, UTF-8, fields split by TAB:
//   devices                              replies "devices", the index of Windows' default
//                                        output in the list (-1 if unknown), then the names
//   play <id> <device> <volume> <tones>  plays a sound on the output with that name ("" =
//                                        Windows' default); <tones> is
//                                        "type,f0,f1,len,level,at,attack,sustain,release,lp0,lp1"
//                                        for each tone, joined with ";" (see Tone)
//   stop <id>                            fades that sound out over 80 ms
//   quit                                 exits; so does the end of input
// Replies on stdout, the same way:
//   ready                                once at start, before any audio API is touched
//   missing <name>                       the first time an output isn't there; its sounds
//                                        play on the default output instead
//   err <text>                           a bad line or an audio error; nothing stops for it
//
// Each output in use gets one waveOut stream, fed 10 ms at a time by its own thread, which
// closes it after 3 s with nothing playing so a Bluetooth headset isn't held open.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public enum Wave { Sine, Triangle, Square, Sawtooth }

// One tone of a sound, the unit the tablet and this player share.
public sealed class Tone
{
    public Wave Type;
    public double F0, F1;   // Hz at the start and at Len: an exponential sweep (equal = steady)
    public double Len;      // s: the sweep and the main envelope
    public double Level;    // peak gain
    public double At;       // s from the start of the sound
    public double Attack;   // s, exponential rise to Level
    public bool Sustain;    // off: decay from the attack to silence at Len; on: hold Level until
                            // Len, then decay over Release
    public double Release;  // s, with Sustain only
    public double Lp0, Lp1; // lowpass cutoff in Hz at the start and at Len; both 0 = none

    // From the tone's start to the end of its envelope.
    public double End { get { return Len + (Sustain ? Release : 0); } }
}

// Renders tones the way public/sound.js schedules them with Web Audio, so a sound is the
// same on the PC as on the tablet. Apart from the player so it can be tested without WinMM.
public static class Synth
{
    public const int Rate = 44100;
    const int MaxTones = 48;
    const double MaxLength = 6; // s, the whole sound
    // Web Audio's exponential ramps can't start or end at 0, so the tablet's envelopes run
    // from and to 0.0001 (-80 dB), and its oscillators stop 30 ms after the envelope ends.
    const double Floor = 0.0001;
    const double Tail = 0.03;
    const int Block = 16;       // samples between exact envelope, pitch and lowpass updates
    static readonly double FilterQ = Math.Pow(10, 1 / 20.0); // BiquadFilter's default Q, 1 dB

    // The tones field of a "play" line; throws FormatException saying what's off.
    public static List<Tone> Parse(string field)
    {
        if (string.IsNullOrEmpty(field)) throw new FormatException("no tones");
        var parts = field.Split(';');
        if (parts.Length > MaxTones) throw new FormatException("more than " + MaxTones + " tones");
        var tones = new List<Tone>(parts.Length);
        double longest = 0;
        for (int i = 0; i < parts.Length; i++)
        {
            string which = "tone " + (i + 1) + ": ";
            var f = parts[i].Split(',');
            if (f.Length != 11) throw new FormatException(which + f.Length + " fields, not 11");
            var k = new Tone();
            switch (f[0].Trim())
            {
                case "sine": k.Type = Wave.Sine; break;
                case "triangle": k.Type = Wave.Triangle; break;
                case "square": k.Type = Wave.Square; break;
                case "sawtooth": k.Type = Wave.Sawtooth; break;
                default: throw new FormatException(which + "no such type");
            }
            k.F0 = Number(f[1], 20, 12000, which + "f0");
            k.F1 = Number(f[2], 20, 12000, which + "f1");
            k.Len = Number(f[3], 0.005, 4, which + "len");
            k.Level = Number(f[4], 0, 1, which + "level");
            k.At = Number(f[5], 0, 4, which + "at");
            k.Attack = Number(f[6], 0.001, 1, which + "attack");
            string sustain = f[7].Trim();
            if (sustain != "0" && sustain != "1") throw new FormatException(which + "sustain isn't 0 or 1");
            k.Sustain = sustain == "1";
            k.Release = Number(f[8], 0, 1, which + "release"); // sent, but unused, without sustain
            k.Lp0 = Cutoff(f[9], which + "lp0");
            k.Lp1 = Cutoff(f[10], which + "lp1");
            if ((k.Lp0 == 0) != (k.Lp1 == 0)) throw new FormatException(which + "lowpass needs both cutoffs or neither");
            longest = Math.Max(longest, k.At + k.End);
            tones.Add(k);
        }
        if (longest > MaxLength + 1e-9) throw new FormatException("longer than " + MaxLength + " s");
        return tones;
    }

    // A number within [min, max], in JavaScript's notation. .NET Framework doesn't always parse
    // JavaScript's shortest form to the very same double, so the ends get a hair of slack.
    internal static double Number(string text, double min, double max, string what)
    {
        double v, slack = 1e-9 * Math.Max(1, max);
        if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out v) || !(v >= min - slack && v <= max + slack))
            throw new FormatException(what + " isn't a number from " + min.ToString(CultureInfo.InvariantCulture) + " to " + max.ToString(CultureInfo.InvariantCulture));
        return Math.Max(min, Math.Min(max, v));
    }

    static double Cutoff(string text, string what)
    {
        return Number(text, 0, 20000, what) == 0 ? 0 : Number(text, 20, 20000, what);
    }

    // The sound at Rate, master gain (0.5 * volume) included. The limiter comes later, in
    // Pcm16, on everything an output plays at once.
    public static float[] Render(IList<Tone> tones, double volume)
    {
        double master = 0.5 * (volume >= 0 ? Math.Min(volume, 1) : 0);
        int length = 0;
        foreach (var k in tones) length = Math.Max(length, Start(k) + Samples(k));
        var mix = new float[length];
        if (master > 0) foreach (var k in tones) Add(mix, k, master);
        return mix;
    }

    static int Start(Tone k) { return (int)Math.Round(k.At * Rate); }
    static int Samples(Tone k) { return (int)Math.Ceiling((k.End + Tail) * Rate); }

    static void Add(float[] mix, Tone k, double master)
    {
        int start = Start(k), count = Samples(k);
        double level = Math.Max(k.Level, 0.0002); // as on the tablet, where a ramp can't reach 0
        double attack = Math.Min(k.Attack, k.Len / 2);
        double rise = Math.Log(level / Floor);
        double sweep = Math.Log(k.F1 / k.F0);
        double sweepStep = Math.Exp(sweep / (k.Len * Rate));
        bool filtered = k.Lp0 > 0;
        double cutSweep = filtered ? Math.Log(k.Lp1 / k.Lp0) : 0;
        double b0 = 0, b1 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
        double phase = 0;
        // Gain, pitch and cutoff all move exponentially, so from one sample to the next each is
        // multiplied by a constant. They're worked out exactly at the start of every Block
        // samples, and blocks also end where the envelope changes course, so
        // rounding can't drift and no block straddles a corner.
        int attackEnd = Edge(attack), lenEnd = Edge(k.Len), end = Edge(k.End);
        for (int n0 = 0; n0 < count; )
        {
            int n1 = Math.Min(count, n0 + Block);
            if (n0 < attackEnd && attackEnd < n1) n1 = attackEnd;
            if (n0 < lenEnd && lenEnd < n1) n1 = lenEnd;
            if (n0 < end && end < n1) n1 = end;
            double t = (double)n0 / Rate;
            double along = Math.Min(t, k.Len) / k.Len; // sweeps end at Len and hold
            double step = k.F0 * Math.Exp(sweep * along) / Rate; // cycles per sample
            double stepBy = t < k.Len ? sweepStep : 1;
            double gainBy;
            double gain = Gain(k, level, attack, rise, t, out gainBy) * master;
            if (filtered)
            {
                // RBJ cookbook lowpass, which is what BiquadFilter "lowpass" is; b2 = b0.
                double w0 = 2 * Math.PI * k.Lp0 * Math.Exp(cutSweep * along) / Rate;
                double cos = Math.Cos(w0), alpha = Math.Sin(w0) / (2 * FilterQ), a0 = 1 + alpha;
                b1 = (1 - cos) / a0;
                b0 = b1 / 2;
                a1 = -2 * cos / a0;
                a2 = (1 - alpha) / a0;
            }
            for (int n = n0; n < n1; n++)
            {
                double s = Oscillator(k.Type, phase, step);
                phase += step;
                if (phase >= 1) phase -= 1; // step < 0.3, so once is enough
                if (filtered)
                {
                    double y = b0 * (s + x2) + b1 * x1 - a1 * y1 - a2 * y2;
                    x2 = x1; x1 = s;
                    y2 = y1; y1 = y;
                    s = y;
                }
                mix[start + n] += (float)(s * gain);
                gain *= gainBy;
                step *= stepBy;
            }
            n0 = n1;
        }
    }

    // The first sample at or after `seconds`.
    static int Edge(double seconds) { return (int)Math.Ceiling(seconds * Rate); }

    // The envelope at t s into the tone, and what it's multiplied by from one sample to the
    // next. Every ramp is exponential between Floor and level, like Web Audio's
    // exponentialRampToValueAtTime; rise is ln(level / Floor).
    static double Gain(Tone k, double level, double attack, double rise, double t, out double perSample)
    {
        perSample = 1;
        if (t < attack)
        {
            perSample = Math.Exp(rise / (attack * Rate));
            return Floor * Math.Exp(rise * t / attack);
        }
        if (!k.Sustain)
        {
            if (t >= k.Len) return Floor;
            perSample = Math.Exp(-rise / ((k.Len - attack) * Rate));
            return level * Math.Exp(-rise * (t - attack) / (k.Len - attack));
        }
        if (t < k.Len) return level;
        if (t >= k.Len + k.Release) return Floor;
        perSample = Math.Exp(-rise / (k.Release * Rate));
        return level * Math.Exp(-rise * (t - k.Len) / k.Release);
    }

    // One sample at phase (0..1 of a cycle), lined up with Web Audio's waveforms, which all
    // start at 0 going up. Square and sawtooth are band-limited with PolyBLEP, as Web Audio's
    // are by other means, so high notes don't alias into whistles. Web Audio scales those two
    // so the ripple at each jump (the Gibbs overshoot, 18%) peaks at 1, which leaves their flat
    // parts at 1 / 1.179; Banded does the same, so they're as loud here as on the tablet.
    const double Banded = 1 / 1.179;

    static double Oscillator(Wave type, double phase, double step)
    {
        double half = phase < 0.5 ? phase + 0.5 : phase - 0.5;
        switch (type)
        {
            case Wave.Sine: return Math.Sin(2 * Math.PI * phase);
            case Wave.Triangle: return phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
            case Wave.Square: return Banded * ((phase < 0.5 ? 1 : -1) + Blep(phase, step) - Blep(half, step));
            default: return Banded * (2 * half - 1 - Blep(half, step)); // drops from 1 to -1 half way through
        }
    }

    // Smooths a jump of 2 at t = 0 (t in cycles, step = cycles per sample).
    static double Blep(double t, double step)
    {
        if (t < step) { t /= step; return t + t - t * t - 1; }
        if (t > 1 - step) { t = (t - 1) / step; return t * t + t + t + 1; }
        return 0;
    }

    // A mixed sample as 16-bit PCM, through the PC's stand-in for the tablet's compressor:
    // untouched up to half scale, then eased toward 0.98, so overlapping sounds never clip.
    public static short Pcm16(double x)
    {
        double a = Math.Abs(x);
        if (double.IsNaN(a)) return 0;
        if (a > 0.5) x = (x < 0 ? -1 : 1) * (0.5 + 0.48 * Math.Tanh((a - 0.5) / 0.48));
        return (short)Math.Round(x * 32767);
    }
}

static class Sound
{
    const int BufferSamples = Synth.Rate / 100; // 10 ms a buffer
    const int Buffers = 4;
    const int IdleSamples = Synth.Rate * 3;     // an output closes after this much silence
    const int FadeSamples = Synth.Rate * 80 / 1000;
    const int StuckMs = 2000;                   // no buffer back for this long: the output is gone

    const uint WAVE_MAPPER = 0xFFFFFFFF;
    const uint CALLBACK_EVENT = 0x00050000;
    const uint WAVE_MAPPED = 0x0004;
    const uint DRVM_MAPPER_PREFERRED_GET = 0x2000 + 21;
    const ushort WAVE_FORMAT_PCM = 1;
    const int WHDR_DONE = 0x0001;
    const int WAVERR_BADFORMAT = 32;

    [StructLayout(LayoutKind.Sequential, Pack = 1)] // mmsystem.h packs it: 18 bytes
    struct WAVEFORMATEX
    {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    // Kept in unmanaged memory, where WinMM sets dwFlags as it finishes with the buffer.
    // The pointers make it 48 bytes on x64, with dwFlags at 24.
    [StructLayout(LayoutKind.Sequential)]
    struct WAVEHDR
    {
        public IntPtr lpData;
        public uint dwBufferLength;
        public uint dwBytesRecorded;
        public IntPtr dwUser;
        public uint dwFlags;
        public uint dwLoops;
        public IntPtr lpNext;
        public IntPtr reserved;
    }

#pragma warning disable 649 // filled in by WinMM
    // The W version, so names come as UTF-16 ("Kopfhörer"); WinMM cuts them at 31 characters.
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct WAVEOUTCAPS
    {
        public ushort wMid;
        public ushort wPid;
        public uint vDriverVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szPname;
        public uint dwFormats;
        public ushort wChannels;
        public ushort wReserved1;
        public uint dwSupport;
    }
#pragma warning restore 649

    [DllImport("winmm.dll")]
    static extern uint waveOutGetNumDevs();

    [DllImport("winmm.dll", EntryPoint = "waveOutGetDevCapsW", CharSet = CharSet.Unicode)]
    static extern int waveOutGetDevCaps(UIntPtr device, ref WAVEOUTCAPS caps, uint size);

    [DllImport("winmm.dll")]
    static extern int waveOutMessage(UIntPtr wave, uint message, out uint param1, out uint param2);

    [DllImport("winmm.dll")]
    static extern int waveOutOpen(out IntPtr wave, uint device, ref WAVEFORMATEX format, IntPtr callback, IntPtr instance, uint flags);

    [DllImport("winmm.dll")]
    static extern int waveOutPrepareHeader(IntPtr wave, IntPtr header, uint size);

    [DllImport("winmm.dll")]
    static extern int waveOutUnprepareHeader(IntPtr wave, IntPtr header, uint size);

    [DllImport("winmm.dll")]
    static extern int waveOutWrite(IntPtr wave, IntPtr header, uint size);

    [DllImport("winmm.dll")]
    static extern int waveOutReset(IntPtr wave);

    [DllImport("winmm.dll")]
    static extern int waveOutClose(IntPtr wave);

    [DllImport("winmm.dll", EntryPoint = "waveOutGetErrorTextW", CharSet = CharSet.Unicode)]
    static extern int waveOutGetErrorText(int error, StringBuilder text, int size);

    static readonly uint HeaderSize = (uint)Marshal.SizeOf(typeof(WAVEHDR));
    static readonly int FlagsOffset = (int)Marshal.OffsetOf(typeof(WAVEHDR), "dwFlags");

    // A sound handed to an output: its samples, how far it's got, and its stop fade.
    sealed class Playing
    {
        public readonly int Id;
        public float[] Samples; // set once rendered
        public int Pos;
        public int FadeLeft = -1; // samples of the stop fade still to play; -1 = not stopping
        public Playing(int id) { Id = id; }
    }

    // Guards outputs, byId and everything in a Playing and in Output.Sounds. Held only to mix
    // or hand over sounds, never across a WinMM call, so nobody waits on audio for it.
    static readonly object sync = new object();
    static readonly Dictionary<string, Output> outputs = new Dictionary<string, Output>(StringComparer.Ordinal);
    static readonly Dictionary<int, Playing> byId = new Dictionary<int, Playing>();
    static volatile bool quitting;
    static readonly Dictionary<string, bool> missing = new Dictionary<string, bool>(StringComparer.Ordinal);
    static readonly List<Output> stranded = new List<Output>();

    static StreamWriter stdout;
    static readonly object outLock = new object();

    static void Say(string line)
    {
        lock (outLock)
        {
            try { stdout.WriteLine(line); }
            catch (IOException) { } // the server has gone; the end of stdin follows
        }
    }

    static string OneLine(string text) { return text.Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' '); }

    static string Failed(string what, int code)
    {
        var text = new StringBuilder(256);
        string why = waveOutGetErrorText(code, text, text.Capacity) == 0 ? text.ToString() : "error";
        return "err " + what + ": " + OneLine(why) + " (" + code + ")";
    }

    static void Main()
    {
        stdout = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
        stdout.AutoFlush = true;
        stdout.NewLine = "\n";
        Say("ready");
        new Thread(Work) { IsBackground = true, Priority = ThreadPriority.AboveNormal }.Start();
        var stdin = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
        string line;
        while ((line = stdin.ReadLine()) != null)
        {
            string word = line.Trim();
            if (word == "quit") break;
            if (word.Length == 0) continue;
            try { Command(line.Split('\t')); }
            catch (Exception ex)
            {
                Say("err " + OneLine(ex.Message) + ": " + OneLine(line.Length > 80 ? line.Substring(0, 80) + "..." : line));
            }
        }
        Quit();
    }

    // Only parses and hands over: rendering, listing outputs and playing happen on other
    // threads, so a slow or stuck output never holds up a stop or the next sound.
    static void Command(string[] f)
    {
        switch (f[0])
        {
            case "devices":
                if (f.Length != 1) break;
                Post(ListDevices);
                return;
            case "play":
                if (f.Length != 5) break;
                int id = Id(f[1]);
                string device = f[2];
                if (device.Length > 64) throw new FormatException("output name longer than 64 characters");
                double volume = Synth.Number(f[3], 0, 1, "volume");
                var tones = Synth.Parse(f[4]);
                var sound = new Playing(id);
                lock (sync) byId[id] = sound; // so a stop that comes before it starts still finds it
                Post(() => Begin(sound, device, tones, volume));
                return;
            case "stop":
                if (f.Length != 2) break;
                Stop(Id(f[1]));
                return;
        }
        throw new FormatException("bad command");
    }

    static int Id(string text)
    {
        int id;
        if (!int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id < 1) throw new FormatException("bad id");
        return id;
    }

    static void Stop(int id)
    {
        lock (sync)
        {
            Playing sound;
            if (byId.TryGetValue(id, out sound) && sound.FadeLeft < 0) sound.FadeLeft = FadeSamples;
        }
    }

    // Under sync.
    static void Forget(Playing sound)
    {
        Playing listed;
        if (byId.TryGetValue(sound.Id, out listed) && listed == sound) byId.Remove(sound.Id);
    }

    // ---------- the worker: renders sounds and lists outputs, in order ----------

    static readonly Queue<Action> jobs = new Queue<Action>();

    static void Post(Action job)
    {
        lock (jobs)
        {
            jobs.Enqueue(job);
            Monitor.Pulse(jobs);
        }
    }

    static void Work()
    {
        while (true)
        {
            Action job;
            lock (jobs)
            {
                while (jobs.Count == 0) Monitor.Wait(jobs);
                job = jobs.Dequeue();
            }
            try { job(); }
            catch (Exception ex) { Say("err " + OneLine(ex.Message)); }
        }
    }

    static void Begin(Playing sound, string device, List<Tone> tones, double volume)
    {
        float[] samples;
        try { samples = Synth.Render(tones, volume); }
        catch
        {
            lock (sync) Forget(sound);
            throw;
        }
        lock (sync)
        {
            sound.Samples = samples;
            if (quitting) { Forget(sound); return; }
            Output output;
            if (!outputs.TryGetValue(device, out output))
            {
                output = new Output(device);
                outputs.Add(device, output);
                // Above the game's threads: it needs a moment every 10 ms, or the sound stutters.
                output.Thread = new Thread(output.Run) { IsBackground = true, Priority = ThreadPriority.Highest };
                output.Thread.Start();
            }
            output.Sounds.Add(sound);
        }
    }

    // "devices", the default output's place in the list, then the names. An output that can't
    // be read (it's just gone) or has no name is left out, and the default's place allows for it.
    static void ListDevices()
    {
        uint count = waveOutGetNumDevs();
        int preferred = Preferred(count), listed = -1;
        var names = new List<string>();
        for (uint i = 0; i < count; i++)
        {
            string name = DeviceName(i);
            if (string.IsNullOrEmpty(name)) continue;
            if (i == preferred) listed = names.Count;
            names.Add(name);
        }
        Say("devices\t" + listed.ToString(CultureInfo.InvariantCulture) + (names.Count > 0 ? "\t" + string.Join("\t", names) : ""));
    }

    // Windows' default output's index, or -1. WAVE_MAPPER is a UINT, so as a handle on x64
    // it's 0x00000000FFFFFFFF, as C code passes it; the sign-extended form is tried as well.
    static int Preferred(uint count)
    {
        uint device, flags;
        int r = waveOutMessage(new UIntPtr(WAVE_MAPPER), DRVM_MAPPER_PREFERRED_GET, out device, out flags);
        if (r != 0 && UIntPtr.Size == 8) r = waveOutMessage(new UIntPtr(ulong.MaxValue), DRVM_MAPPER_PREFERRED_GET, out device, out flags);
        return r == 0 && device < count ? (int)device : -1;
    }

    static string DeviceName(uint index)
    {
        var caps = new WAVEOUTCAPS();
        if (waveOutGetDevCaps(new UIntPtr(index), ref caps, (uint)Marshal.SizeOf(typeof(WAVEOUTCAPS))) != 0) return null;
        return OneLine(caps.szPname ?? "");
    }

    // The waveOut index of the output with this name, looked up each time a stream opens since
    // outputs come and go and indexes shift. Windows' default when it's "" or not there.
    static uint Resolve(string name)
    {
        if (name.Length == 0) return WAVE_MAPPER;
        uint count = waveOutGetNumDevs();
        for (uint i = 0; i < count; i++) if (DeviceName(i) == name) return i;
        bool first;
        lock (missing)
        {
            first = !missing.ContainsKey(name);
            missing[name] = true;
        }
        if (first) Say("missing\t" + name);
        return WAVE_MAPPER;
    }

    // Closes every output, giving them a second between them, before the process ends.
    static void Quit()
    {
        List<Output> open;
        lock (sync)
        {
            quitting = true;
            open = new List<Output>(outputs.Values);
        }
        int until = Environment.TickCount + 1000;
        foreach (var output in open)
        {
            output.Wake.Set();
            int left = until - Environment.TickCount;
            if (left > 0 && output.Thread != null) output.Thread.Join(left);
        }
    }

    // ---------- an output: one waveOut stream and the sounds playing on it ----------

    sealed class Output
    {
        public readonly string Name; // "" = Windows' default
        public readonly List<Playing> Sounds = new List<Playing>();
        public readonly AutoResetEvent Wake = new AutoResetEvent(false); // WinMM sets it as buffers come back
        public Thread Thread;

        IntPtr wave;
        readonly IntPtr[] headers = new IntPtr[Buffers], data = new IntPtr[Buffers];
        readonly bool[] prepared = new bool[Buffers];
        readonly bool[] queued = new bool[Buffers]; // WinMM holds it: hands off until it's done
        readonly float[] mix = new float[BufferSamples];
        readonly short[] pcm = new short[BufferSamples];

        public Output(string name) { Name = name; }

        string Label() { return Name.Length == 0 ? "default output" : "output \"" + Name + "\""; }

        public void Run()
        {
            try { if (Open()) Feed(); }
            catch (Exception ex) { Say("err " + Label() + ": " + OneLine(ex.Message)); }
            finally
            {
                Unlist(true);
                try { Close(); }
                catch (Exception ex) { Say("err " + Label() + ": " + OneLine(ex.Message)); }
            }
        }

        bool Open()
        {
            uint device = Resolve(Name);
            var format = new WAVEFORMATEX
            {
                wFormatTag = WAVE_FORMAT_PCM, nChannels = 1, nSamplesPerSec = Synth.Rate,
                nAvgBytesPerSec = Synth.Rate * 2, nBlockAlign = 2, wBitsPerSample = 16, cbSize = 0,
            };
            IntPtr callback = Wake.SafeWaitHandle.DangerousGetHandle();
            int r = waveOutOpen(out wave, device, ref format, callback, IntPtr.Zero, CALLBACK_EVENT);
            // An output that won't take 44.1 kHz mono itself gets it converted by the mapper.
            if (r == WAVERR_BADFORMAT && device != WAVE_MAPPER)
                r = waveOutOpen(out wave, device, ref format, callback, IntPtr.Zero, CALLBACK_EVENT | WAVE_MAPPED);
            if (r != 0)
            {
                wave = IntPtr.Zero;
                Say(Failed("can't open " + Label(), r));
                return false;
            }
            for (int i = 0; i < Buffers; i++)
            {
                // Unmanaged, so they stay put while WinMM holds them.
                data[i] = Marshal.AllocHGlobal(BufferSamples * 2);
                headers[i] = Marshal.AllocHGlobal((int)HeaderSize);
                var header = new WAVEHDR
                {
                    lpData = data[i], dwBufferLength = BufferSamples * 2, dwBytesRecorded = 0, dwUser = IntPtr.Zero,
                    dwFlags = 0, dwLoops = 0, lpNext = IntPtr.Zero, reserved = IntPtr.Zero,
                };
                Marshal.StructureToPtr(header, headers[i], false);
                r = waveOutPrepareHeader(wave, headers[i], HeaderSize);
                if (r != 0)
                {
                    Say(Failed(Label() + ": waveOutPrepareHeader", r));
                    return false;
                }
                prepared[i] = true;
            }
            return true;
        }

        // Keeps every buffer queued, refilling each as WinMM hands it back, until the output
        // has been quiet for 3 s, stops taking buffers, or the helper quits.
        void Feed()
        {
            for (int i = 0; i < Buffers; i++)
            {
                Fill(i);
                if (!Write(i)) return;
            }
            int quiet = 0, lastBack = Environment.TickCount;
            while (!quitting)
            {
                Wake.WaitOne(50);
                bool back = false;
                for (int i = 0; i < Buffers && !quitting; i++)
                {
                    if (!queued[i] || (Marshal.ReadInt32(headers[i], FlagsOffset) & WHDR_DONE) == 0) continue;
                    queued[i] = false;
                    back = true;
                    if (quiet >= IdleSamples && Unlist(false)) return;
                    quiet = Fill(i) ? 0 : quiet + BufferSamples;
                    if (!Write(i)) return;
                }
                if (back) lastBack = Environment.TickCount;
                else if (Environment.TickCount - lastBack > StuckMs)
                {
                    Say("err " + Label() + " stopped taking sound");
                    return;
                }
            }
        }

        // Mixes the next 10 ms of this output's sounds into buffer i; false if none played.
        bool Fill(int i)
        {
            Array.Clear(mix, 0, BufferSamples);
            bool any;
            lock (sync) any = Mix();
            for (int k = 0; k < BufferSamples; k++) pcm[k] = Synth.Pcm16(mix[k]);
            Marshal.Copy(pcm, 0, data[i], BufferSamples);
            return any;
        }

        // Under sync.
        bool Mix()
        {
            bool any = Sounds.Count > 0;
            for (int j = Sounds.Count - 1; j >= 0; j--)
            {
                var s = Sounds[j];
                int n = Math.Min(BufferSamples, s.Samples.Length - s.Pos);
                if (s.FadeLeft >= 0) n = Math.Min(n, s.FadeLeft);
                for (int k = 0; k < n; k++)
                {
                    float x = s.Samples[s.Pos + k];
                    mix[k] += s.FadeLeft < 0 ? x : x * (s.FadeLeft - k) / (float)FadeSamples;
                }
                s.Pos += n;
                if (s.FadeLeft >= 0) s.FadeLeft -= n;
                if (s.Pos >= s.Samples.Length || s.FadeLeft == 0)
                {
                    Sounds.RemoveAt(j);
                    Forget(s);
                }
            }
            return any;
        }

        bool Write(int i)
        {
            // The buffer is ours until this hands it over; clearing DONE first means a flag
            // left over from its last trip can't make it look finished once it's queued.
            Marshal.WriteInt32(headers[i], FlagsOffset, Marshal.ReadInt32(headers[i], FlagsOffset) & ~WHDR_DONE);
            int r = waveOutWrite(wave, headers[i], HeaderSize);
            if (r != 0)
            {
                Say(Failed(Label() + ": waveOutWrite", r));
                return false;
            }
            queued[i] = true;
            return true;
        }

        // Takes this output off the list, so the next sound for it opens a fresh stream (and
        // looks the output up again). Unless forced, only while nothing is playing on it.
        bool Unlist(bool force)
        {
            lock (sync)
            {
                if (!force && Sounds.Count > 0) return false;
                Output listed;
                if (outputs.TryGetValue(Name, out listed) && listed == this) outputs.Remove(Name);
                foreach (var s in Sounds) Forget(s);
                Sounds.Clear();
                return true;
            }
        }

        // Takes the buffers back and closes the stream. A buffer WinMM won't hand back is left
        // alone, never freed, and so is anything else it might still write to.
        void Close()
        {
            bool stuck = false;
            if (wave != IntPtr.Zero)
            {
                waveOutReset(wave); // hands back every queued buffer, marked done
                for (int waited = 0; waited < 500 && StillQueued(); waited += 10) Thread.Sleep(10);
            }
            for (int i = 0; i < Buffers; i++)
            {
                if (queued[i]) { stuck = true; continue; }
                if (prepared[i])
                {
                    if (waveOutUnprepareHeader(wave, headers[i], HeaderSize) != 0) { stuck = true; continue; }
                    prepared[i] = false;
                }
                if (headers[i] != IntPtr.Zero) Marshal.FreeHGlobal(headers[i]);
                if (data[i] != IntPtr.Zero) Marshal.FreeHGlobal(data[i]);
                headers[i] = data[i] = IntPtr.Zero;
            }
            if (wave != IntPtr.Zero && waveOutClose(wave) != 0) stuck = true;
            wave = IntPtr.Zero;
            // Keeps the event WinMM may still set from being collected and its handle reused.
            if (stuck) lock (stranded) stranded.Add(this);
        }

        // True while WinMM holds any buffer; notes the ones it has handed back.
        bool StillQueued()
        {
            bool any = false;
            for (int i = 0; i < Buffers; i++)
            {
                if (!queued[i]) continue;
                if ((Marshal.ReadInt32(headers[i], FlagsOffset) & WHDR_DONE) != 0) queued[i] = false;
                else any = true;
            }
            return any;
        }
    }
}
