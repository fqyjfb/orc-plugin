#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Install Python dependencies for OCR service
"""
import subprocess
import sys
import os
import shutil

def cleanup_all_corrupted(site_packages):
    cleaned_count = 0
    entries = os.listdir(site_packages)
    for entry in entries:
        entry_path = os.path.join(site_packages, entry)
        if not os.path.isdir(entry_path):
            continue
        
        is_dist_info = entry.endswith('.dist-info')
        is_cache = entry.startswith('__')
        
        if is_cache:
            continue
        
        if is_dist_info:
            record_file = os.path.join(entry_path, 'RECORD')
            meta_file = os.path.join(entry_path, 'METADATA')
            if not os.path.isfile(record_file) or not os.path.isfile(meta_file):
                print(f"  [WARN] Removing corrupted dist-info: {entry}")
                shutil.rmtree(entry_path, ignore_errors=True)
                cleaned_count += 1
            continue
        
        init_file = os.path.join(entry_path, '__init__.py')
        if not os.path.isfile(init_file):
            print(f"  [WARN] Removing corrupted package: {entry} (missing __init__.py)")
            shutil.rmtree(entry_path, ignore_errors=True)
            cleaned_count += 1
    
    return cleaned_count

def verify_package(module_name, import_names=None):
    try:
        module = __import__(module_name)
        module_file = getattr(module, '__file__', None)
        if module_file is None:
            return False, f"{module_name} is a namespace package (corrupted)"
        if import_names:
            for name in import_names:
                if not hasattr(module, name):
                    return False, f"{module_name} missing {name}"
        return True, f"{module_name} OK"
    except ImportError:
        return False, f"{module_name} not importable"
    except Exception as e:
        return False, f"{module_name} error: {str(e)}"

def main():
    print("=" * 60)
    print("Installing OCR Service Dependencies")
    print("=" * 60)
    
    py_version = sys.version_info
    print(f"[INFO] Python Version: {py_version.major}.{py_version.minor}.{py_version.micro}")
    
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
        print("\n[INFO] Scanning for corrupted packages...")
        
        site_packages = None
        for p in sys.path:
            if 'site-packages' in p and os.path.isdir(p):
                site_packages = p
                break
        
        if site_packages:
            cleaned = cleanup_all_corrupted(site_packages)
            if cleaned > 0:
                print(f"[INFO] Cleaned {cleaned} corrupted items")
            else:
                print("[INFO] No corrupted packages found")
        
        print("\n[INFO] Installing dependencies...")
        install_cmd = [
            sys.executable,
            "-m", "pip", "install",
            "--ignore-installed",
            "--no-cache-dir",
            "-r", requirements_path
        ]
        if force_reinstall:
            install_cmd.insert(-3, "--upgrade")
        
        result = subprocess.run(install_cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[ERROR] pip install failed:")
            print(result.stderr)
            return 1
        
        print("\n[INFO] Verifying installation...")
        all_ok = True
        checks = [
            ("fastapi", ["FastAPI"]),
            ("uvicorn", ["run"]),
            ("pydantic", ["BaseModel"]),
            ("PIL", ["Image"]),
            ("rapidocr_onnxruntime", []),
        ]
        for module_name, import_names in checks:
            ok, msg = verify_package(module_name, import_names)
            status = "[OK]" if ok else "[FAIL]"
            print(f"  {status} {msg}")
            if not ok:
                all_ok = False
        
        if not all_ok:
            print("\n[ERROR] Some packages failed verification. Try:")
            print("  1. Close all applications using Python")
            print("  2. Run this script again with --force flag")
            return 1
        
        print("\n" + "=" * 60)
        print("[OK] Dependencies installed and verified successfully!")
        print("=" * 60)
        return 0
        
    except Exception as e:
        print(f"\n[ERROR] Installation failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
