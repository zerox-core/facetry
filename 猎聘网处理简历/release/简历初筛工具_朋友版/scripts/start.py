#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cross-platform launcher for the Resume Screener.

Starts the Flask backend, launches Chrome in debug mode (CDP on :9222),
and opens the tool page in the default browser.

Usage:
    python scripts/start.py        # from project root, or
    python start.py                # from inside scripts/
"""
import os
import sys
import time
import shutil
import subprocess
import webbrowser
import urllib.request


HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # scripts/ -> project root


def find_chrome():
    if sys.platform == "win32":
        candidates = [
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
    elif sys.platform == "darwin":
        candidates = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    else:
        candidates = ["google-chrome", "chromium", "chromium-browser"]
    for c in candidates:
        if os.path.exists(c):
            return c
        if shutil.which(c):
            return c
    return None


def port_open(port, host="127.0.0.1"):
    try:
        urllib.request.urlopen(f"http://{host}:{port}/", timeout=1)
        return True
    except Exception:
        return False


def run(cmd, **kw):
    flags = 0
    if sys.platform == "win32":
        flags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
    kw.setdefault("cwd", ROOT)
    return subprocess.Popen(cmd, creationflags=flags, **kw)


def main():
    os.chdir(ROOT)
    print("===== Resume Screener Launcher =====")

    # install deps (best effort)
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt", "--quiet"],
            check=False,
        )
    except Exception:
        pass

    # backend on 7788
    if not port_open(7788):
        print("[1/3] Starting backend on 7788 ...")
        run([sys.executable, "-m", "app.main"])
        time.sleep(6)
    else:
        print("[1/3] Backend already running on 7788, skip")

    # chrome debug on 9222
    if not port_open(9222):
        print("[2/3] Starting Chrome debug on 9222 ...")
        chrome = find_chrome()
        if not chrome:
            print("[ERROR] Chrome not found. Please install Google Chrome.")
            sys.exit(1)
        ud = os.path.join(os.environ.get("TEMP", "/tmp"), "liepin_debug")
        run([
            chrome,
            "--remote-debugging-port=9222",
            "--remote-allow-origins=*",
            f"--user-data-dir={ud}",
        ])
        time.sleep(6)
    else:
        print("[2/3] Chrome debug already running on 9222, skip")

    # open tool page
    print("[3/3] Opening tool page ...")
    webbrowser.open("http://127.0.0.1:7788/")
    print("Done! In the debug Chrome, log in to liepin / 51job, then click 'Scan new resumes'.")


if __name__ == "__main__":
    main()
