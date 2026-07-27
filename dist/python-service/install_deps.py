#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Install Python dependencies for OCR service
"""
import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("Installing OCR Service Dependencies")
    print("=" * 60)
    
    py_version = sys.version_info
    print(f"[INFO] Python Version: {py_version.major}.{py_version.minor}.{py_version.micro}")
    
    if py_version.major >= 3 and py_version.minor >= 13:
        print("[WARN] Python 3.13+ detected. Some packages may have compatibility issues.")
        print("[WARN] Recommended: Python 3.8 - 3.12 for best compatibility")
    
    force_reinstall = "--force" in sys.argv
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    requirements_path = os.path.join(script_dir, "requirements.txt")
    
    if not os.path.exists(requirements_path):
        print(f"[ERROR] Requirements file not found: {requirements_path}")
        return 1
    
    print(f"[INFO] Using requirements file: {requirements_path}")
    if force_reinstall:
        print("[INFO] Force reinstall mode enabled")
    
    try:
        print("\n[INFO] Upgrading pip...")
        subprocess.check_call([
            sys.executable,
            "-m", "pip", "install", "--upgrade", "pip"
        ])
        
        print("\n[INFO] Installing dependencies...")
        install_cmd = [
            sys.executable,
            "-m", "pip", "install", "-r", requirements_path
        ]
        if force_reinstall:
            install_cmd.insert(-1, "--force-reinstall")
        
        subprocess.check_call(install_cmd)
        
        print("\n" + "=" * 60)
        print("[OK] Dependencies installed successfully!")
        print("=" * 60)
        return 0
        
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Installation failed with exit code {e.returncode}")
        print("\nPlease try:")
        print("  1. Check your internet connection")
        print("  2. Run with admin/sudo privileges if needed")
        print("  3. Try manually: pip install --force-reinstall -r requirements.txt")
        print("  4. If fastapi import fails, try: pip uninstall -y fastapi && pip install fastapi")
        return 1
    except Exception as e:
        print(f"\n[ERROR] Installation failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
