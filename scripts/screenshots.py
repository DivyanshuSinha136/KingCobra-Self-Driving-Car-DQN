#!/usr/bin/env python3
"""Capture the dashboard screenshots in docs/img/ with headless Chromium.

    pip install playwright && playwright install chromium
    make serve          # in another terminal
    python3 scripts/screenshots.py [http://127.0.0.1:8766] [part]      part = a (default) | b

Part a: overview, chase camera, shared-network panel, Q grid, drifter model, curves, mobile.
Part b: a human driving with the handbrake (drift), reversing, and the AI-vs-baseline benchmark.
"""
import os, sys, time
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766"
PART = sys.argv[2] if len(sys.argv) > 2 else "a"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "img") + os.sep


def set_speed(pg, v):
    pg.evaluate("v => { const s = document.getElementById('speed'); s.value = v; s.dispatchEvent(new Event('input')); }", v)


def card(pg, inner):
    return pg.locator(inner).locator("xpath=ancestor::section[1]")


def wait_for(pg, js, timeout=25):
    end = time.time() + timeout
    while time.time() < end:
        if pg.evaluate(js):
            return True
        time.sleep(0.15)
    return False


def open_page(b, size=(1280, 900), scale=2):
    pg = b.new_page(viewport={"width": size[0], "height": size[1]}, device_scale_factor=scale)
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL + "/")
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_selector("#features .frow", state="attached")
    return pg, errs


with sync_playwright() as p:
    b = p.chromium.launch()
    if PART == "a":
        pg, errs = open_page(b)
        set_speed(pg, 25)
        time.sleep(7)
        pg.screenshot(path=OUT + "dashboard.png", full_page=True)
        card(pg, "#netTitle").screenshot(path=OUT + "network.png")
        card(pg, "#qTitle").screenshot(path=OUT + "qgrid.png")
        pg.evaluate("document.getElementById('btnReset').click()"); time.sleep(0.5)
        set_speed(pg, 14); pg.keyboard.press("c"); pg.keyboard.press(" "); time.sleep(4.5)
        pg.locator(".board-card").screenshot(path=OUT + "chase.png")
        card(pg, "#curveTitle").screenshot(path=OUT + "training-curves.png")
        # the drifter model
        pg.select_option("#modelSel", "drifter_ddqn")
        wait_for(pg, "!document.getElementById('badgeDrift').classList.contains('is-hidden')", 40)
        time.sleep(1.2)
        pg.locator(".board-card").screenshot(path=OUT + "drifter.png")
        m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        m.goto(URL + "/"); m.wait_for_selector("#features .frow", state="attached"); time.sleep(5)
        m.screenshot(path=OUT + "mobile.png")
        print("errors:", errs)
    else:
        pg, errs = open_page(b)
        pg.evaluate("document.getElementById('autoRestart').click()")      # we drive manually
        pg.evaluate("() => { const n = document.getElementById('npcs'); n.value = 0; n.dispatchEvent(new Event('change')); }")
        time.sleep(0.8)
        pg.click("#modeHuman"); time.sleep(0.8)
        pg.keyboard.press("c")
        pressed = set()

        def hold(keys):
            for k in pressed - keys: pg.keyboard.up(k)
            for k in keys - pressed: pg.keyboard.down(k)
            pressed.clear(); pressed.update(keys)

        def assist(seconds, handbrake=False, until=None):
            """Steer along the network's racing line (as a human following it would) and hold the gas.
            With `until` (a JS expression) it returns as soon as that becomes true."""
            end = time.time() + seconds
            while time.time() < end:
                if until and pg.evaluate(until): return True
                a = pg.evaluate("() => fetch('/api/state?sid=' + sessionStorage.getItem('selfdrive-dqn:sid')).then(r => r.json()).then(s => s.best_action)")
                steer = a // 4
                keys = {"ArrowUp"}
                if steer == 0: keys.add("ArrowLeft")
                if steer == 2: keys.add("ArrowRight")
                if handbrake:
                    keys.add(" ")
                    if steer == 1: keys.add("ArrowLeft")
                hold(keys)
                time.sleep(0.05)
            return False

        assist(7)                                                             # build speed on the racing line
        assist(4, handbrake=True, until="!document.getElementById('badgeDrift').classList.contains('is-hidden')")   # handbrake slide
        pg.locator(".board-card").screenshot(path=OUT + "human-drift.png")
        card(pg, "#telTitle").screenshot(path=OUT + "telemetry.png")
        hold({"ArrowDown"})                                                   # brake, then reverse
        wait_for(pg, "!document.getElementById('badgeRev').classList.contains('is-hidden')", 14)
        time.sleep(0.5)
        pg.locator(".board-card").screenshot(path=OUT + "reverse.png")
        hold(set())
        pg.click("#modeAi"); pg.keyboard.press("c")
        pg.click("#btnBench")
        wait_for(pg, "!document.getElementById('benchOut').classList.contains('is-hidden')", 120)
        time.sleep(1)
        card(pg, "#benchTitle").screenshot(path=OUT + "benchmark.png")
        print("errors:", errs)
    b.close()
