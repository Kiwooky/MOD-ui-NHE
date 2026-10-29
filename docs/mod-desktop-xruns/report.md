# JACK stops processing for ~1 hour at a time (375 xruns/s) at 128 frames on macOS; engine dies after sleep/wake

## Setup

- MOD Desktop 0.0.13, jackdmp 1.9.22 (as bundled)
- Mac mini, Apple M4, macOS 26.5.2 (25F84)
- Audio: built-in speakers (output only) and TASCAM iXR (USB, duplex); same result on both
- 48 kHz, light load: one small pedalboard, MOD Desktop mostly idle in the background, the web UI open in one browser tab

## Summary

1. At **128 frames**, JACK periodically stops processing entirely. `launcher.log` then shows `DeviceNotificationCallback kAudioDeviceProcessorOverload` **375 times a second** (48000 / 128, i.e. every cycle) for about an hour, after which it either recovers by itself or MOD Desktop has to be restarted. Outside these stalls there are a few xruns a minute.
2. At **256 frames** the same machine ran for 14 hours with no stall (about 1–2 xruns a minute).
3. Separately: after the Mac **sleeps and wakes** with the iXR attached, every JACK client fails and is deactivated. jackd keeps running with no audio until MOD Desktop is restarted.

## 1. Stalls at 128 frames

Times are local (NZDT), from `launcher.log`:

| Date | Device | Stall | How it ended |
|---|---|---|---|
| Oct 28 | Built-in speakers | 12:32 → 12:34 | by itself |
| Oct 28 | Built-in speakers | 13:00 → 13:28 | restart |
| Oct 28 | iXR duplex | 14:13:56 → 15:15:3x | by itself (~62 min) |
| Oct 28 | iXR duplex | 18:47:55 → 18:54 | restart |
| Oct 28 | iXR duplex, App Nap off | 20:33:19 → 20:36:16 | by itself |
| Oct 28 | iXR duplex, App Nap off | 20:38:48 → 21:44:53 | by itself (~66 min) |

Each stall begins abruptly, sometimes after a few minutes of rising xruns, and goes straight to every cycle overloading. The log grew to 1.5 GB in a day this way.

**Ruled out:**
- **Output device:** it happens on both the built-in output and the USB interface.
- **App Nap:** `defaults write audio.mod.desktop NSAppSleepDisabled -bool YES` made no difference.
- **Display sleep:** stalls started both with the display on and off, and ended both ways.
- **Number of browser clients:** it happened with one tab and with two.
- **System sleep:** none during these runs.

### What the processes are doing during a stall

Captured with `sample` during the 18:47 stall (full files attached: `jackd.sample`, `modui.sample`). jackd's CPU dropped from ~25% to ~4%.

In **jackd**, over 3 seconds the CoreAudio IO thread **never calls JACK's render callback**. It sits in the HAL work loop, and only wakes up to deliver the overload property notification:

```
Thread_8764199: com.apple.audio.IOThread.client
  HALC_IOThread::Entry
    HALC_ProxyIOContext::IOWorkLoop()
      2310/2331  caulk::mach::semaphore::wait_signal_or_error -> semaphore_wait_signal_trap
        13/2331  HALSystem::AudioObjectPropertiesChanged -> (libjackserver) -> write / pthread_cond_signal
         8/2331  caulk::mach::semaphore::signal_or_error
```

The rest of jackd is idle. Its clients' threads (mod-host, mod-midi-merger, mod-midi-broadcaster) are waiting on their futexes, and the main thread is in `sigwait`. A separate jackd thread spends some time in `default_jack_error_callback -> fprintf -> write`, logging the overloads.

In **mod-ui**, the JACK client threads are idle as well (`pthread_cond_wait`, and `read` waiting for the server), and the Python main thread is in its normal `kevent` loop. So mod-ui isn't blocking the graph. When jackd shuts down during or after a stall, it logs `JackEngine::ClientDeactivate wait error ... name = mod-ui`, but that also happens on a normal shutdown.

So it looks like CoreAudio stops running JACK's IOProc on schedule and reports every cycle as an overload, rather than a client taking too long.

## 2. 256 frames

- Oct 28 23:59 → Oct 29 00:41: no stall, until the Mac went to sleep (see 3).
- Oct 29 07:38:24 → 21:49 (14 h 10 min, idle sleep prevented with `caffeinate -i`): **no stall**, 1553 xruns in total. Per hour, these ranged from 30 to 300, the higher counts during the day while the machine was in use.

At 128 frames, the longest clean run before a stall was about 2.5 hours.

## 3. Engine dies after sleep/wake

At 00:41:53 the Mac entered sleep while MOD Desktop was running (256 frames, iXR duplex). It then made several dark wakes, caused by USB events. After the one at 02:25:15, `launcher.log` shows:

```
2026-10-29 02:26:58 SuspendRefNum error
JackClient::Execute error name = effect_3
JackClient::Execute error name = effect_2
JackClient::Execute error name = effect_4
SuspendRefNum error
JackClient::Execute error name = mod-midi-broadcaster
SuspendRefNum error
JackClient::Execute error name = mod-monitor
2026-10-29 02:26:58 SuspendRefNum error
JackClient::Execute error name = mod-host
2026-10-29 02:26:59 JackPosixProcessSync::LockedTimedWait error usec = 106660 err = Operation timed out
2026-10-29 02:26:59 JackEngine::ClientDeactivate wait error ref = 3 name = mod-midi-merger
JackEngine::ClientDeactivate wait error ref = 11 name = effect_4
JackEngine::ClientDeactivate wait error ref = 8 name = effect_3
JackEngine::ClientDeactivate wait error ref = 4 name = mod-midi-broadcaster
JackEngine::ClientDeactivate wait error ref = 5 name = mod-host
JackEngine::ClientDeactivate wait error ref = 6 name = mod-monitor
JackEngine::ClientDeactivate wait error ref = 10 name = effect_2
```

After that, the CoreMIDI driver restarts and repeatedly logs `Cannot connect ports owned by inactive clients: "mod-midi-merger" is not active`. jackd stays up at ~0% CPU with no audio, and the web UI keeps running, until MOD Desktop is restarted.

## Command lines

128 frames:

```
jackd -R -S -n mod-desktop -X coremidi -C ./jack/jack-session.conf -d coreaudio -r 48000 -p 128 -d "AppleUSBAudioEngine:TEAC CORPORATION:TASCAM iXR: NONE :1,2"
```

256 frames:

```
jackd -R -S -n mod-desktop -X coremidi -C ./jack/jack-session.conf -d coreaudio -r 48000 -p 256 -d "AppleUSBAudioEngine:TEAC CORPORATION:TASCAM iXR: NONE :1,2"
```

The built-in output used `-P Default`.
