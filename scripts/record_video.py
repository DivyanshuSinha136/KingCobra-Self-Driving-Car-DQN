#!/usr/bin/env python3
"""Record a gameplay video of the dashboard with headless Chromium + ffmpeg.

    pip install playwright && playwright install chromium     # and ffmpeg on your PATH
    make serve                                                 # in another terminal
    python3 scripts/record_video.py [http://127.0.0.1:8766]

Story: the AI races in traffic (overview), the chase camera, the "drifter" model slides, then a person takes the wheel
(handbrake drift, reverse) and hands back to the AI. Writes docs/media/gameplay.mp4 and docs/img/gameplay.gif.
"""
import glob, os, shutil, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766"
HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "..", "docs", "media")
IMG = os.path.join(HERE, "..", "docs", "img")
os.makedirs(MEDIA, exist_ok=True)
W, H = 1280, 900

tmp = tempfile.mkdtemp(prefix="drive_rec_")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": W, "height": H}, record_video_dir=tmp, record_video_size={"width": W, "height": H})
    pg = ctx.new_page()
    pg.goto(URL + "/")
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_selector("#features .frow", state="attached")
    pg.evaluate("window.scrollTo(0, 0)")

    def js(code, arg=None):
        return pg.evaluate(code, arg) if arg is not None else pg.evaluate(code)

    def set_speed(v):
        js("v => { const s = document.getElementById('speed'); s.value = v; s.dispatchEvent(new Event('input')); }", v)

    def set_npcs(n):
        js("n => { const e = document.getElementById('npcs'); e.value = n; e.dispatchEvent(new Event('change')); }", n)

    pressed = set()

    def hold(keys):
        for k in pressed - keys: pg.keyboard.up(k)
        for k in keys - pressed: pg.keyboard.down(k)
        pressed.clear(); pressed.update(keys)

    def assist(seconds, handbrake=False, until=None):
        """A person following the network's racing line: its steering, the gas held, plus the handbrake on demand."""
        end = time.time() + seconds
        while time.time() < end:
            if until and js(until): return True
            a = js("() => fetch('/api/state?sid=' + sessionStorage.getItem('selfdrive-dqn:sid')).then(r => r.json()).then(s => s.best_action)")
            keys = {"ArrowUp"}
            if a // 4 == 0: keys.add("ArrowLeft")
            if a // 4 == 2: keys.add("ArrowRight")
            if handbrake:
                keys.add(" ")
                if a // 4 == 1: keys.add("ArrowLeft")
            hold(keys)
            time.sleep(0.05)
        return False

    # 1. AI racing in traffic, whole-track view
    set_speed(20)
    time.sleep(8)
    # 2. chase camera
    pg.keyboard.press("c"); time.sleep(6)
    # 3. the drifter model
    pg.select_option("#modelSel", "drifter_ddqn")
    time.sleep(9)
    # 4. a person takes the wheel: racing line + handbrake slide + reverse
    pg.select_option("#modelSel", "driver_ddqn"); time.sleep(0.6)
    js("document.getElementById('autoRestart').click()")
    set_npcs(0); time.sleep(0.6)
    pg.click("#modeHuman"); time.sleep(0.6)
    set_speed(10)
    assist(6)
    assist(3, handbrake=True, until="!document.getElementById('badgeDrift').classList.contains('is-hidden')")
    assist(1.2, handbrake=True)
    hold({"ArrowUp"}); time.sleep(0.8)
    hold({"ArrowDown"})
    end = time.time() + 6
    while time.time() < end and js("document.getElementById('badgeRev').classList.contains('is-hidden')"): time.sleep(0.1)
    time.sleep(2.0)
    hold(set())
    # 5. the AI takes over again, with traffic
    js("document.getElementById('autoRestart').click()")
    set_npcs(4); time.sleep(0.5)
    pg.click("#modeAi"); time.sleep(0.4)
    pg.keyboard.press(" ")
    set_speed(20); pg.keyboard.press("c")
    time.sleep(6)
    ctx.close(); b.close()

webm = glob.glob(os.path.join(tmp, "*.webm"))[0]
mp4 = os.path.join(MEDIA, "gameplay.mp4")
gif = os.path.join(IMG, "gameplay.gif")
trim = ["-ss", "1.2"]
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-crf", "25", "-preset", "slow", "-movflags", "+faststart", "-an", mp4], check=True)
palette = os.path.join(tmp, "pal.png")
vf = "crop=1280:740:0:0,fps=8,scale=640:-1:flags=lanczos"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-vf", vf + ",palettegen=max_colors=48:stats_mode=diff", palette], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", webm, "-i", palette, "-lavfi",
                vf + "[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0", gif], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print("wrote", os.path.normpath(mp4), os.path.getsize(mp4) // 1024, "KB;", os.path.normpath(gif), os.path.getsize(gif) // 1024, "KB")
