#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR Service Diagnostics Tool
Helps check if Python environment and dependencies are properly installed
"""
import sys
import os
import subprocess
import importlib.util

def check_python_version():
    print("=" * 60)
    print("Python Version Check")
    print("=" * 60)
    version = sys.version_info
    print(f"Current Version: {version.major}.{version.minor}.{version.micro}")
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("[WARN] Warning: Python 3.8+ is recommended")
        return False
    print("[OK] Python version meets requirements")
    return True

def check_dependency(module_name, package_name=None, import_names=None):
    package_name = package_name or module_name
    spec = importlib.util.find_spec(module_name)
    if spec is None:
        print(f"[FAIL] {package_name} not installed")
        return False
    
    try:
        module = importlib.import_module(module_name)
        module_file = getattr(module, '__file__', None)
        if module_file is None:
            print(f"[FAIL] {package_name} installed but corrupted (namespace package, missing __init__.py)")
            print(f"       修复方法: 运行 'python install_deps.py --force'")
            return False
        if import_names:
            for name in import_names:
                if not hasattr(module, name):
                    print(f"[FAIL] {package_name} installed but missing {name} (corrupted)")
                    print(f"       修复方法: 运行 'python install_deps.py --force'")
                    return False
        print(f"[OK] {package_name} installed")
        return True
    except Exception as e:
        print(f"[FAIL] {package_name} installed but import failed: {e}")
        return False

def check_dependencies():
    print("\n" + "=" * 60)
    print("Dependencies Check")
    print("=" * 60)

    dependencies = [
        ("fastapi", "fastapi", ["FastAPI", "APIRouter"]),
        ("uvicorn", "uvicorn", ["run"]),
        ("pydantic", "pydantic", ["BaseModel"]),
        ("rapidocr_onnxruntime", "rapidocr-onnxruntime", []),
        ("PIL", "Pillow", ["Image"]),
    ]

    all_installed = True
    for module_name, package_name, import_names in dependencies:
        if not check_dependency(module_name, package_name, import_names):
            all_installed = False

    return all_installed

def get_process_name(pid):
    """通过PID查询进程名"""
    try:
        if sys.platform == 'win32':
            result = subprocess.run(
                f'tasklist /FI "PID eq {pid}" /NH /FO CSV',
                shell=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            if result.stdout.strip():
                # CSV格式: "python.exe","1234","Console","1","12,345 K"
                parts = result.stdout.strip().split('","')
                if parts:
                    name = parts[0].strip('"')
                    return name
        else:
            result = subprocess.run(
                f'ps -p {pid} -o comm=',
                shell=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            if result.stdout.strip():
                return result.stdout.strip()
    except Exception:
        pass
    return None


def check_port(port=8766):
    print("\n" + "=" * 60)
    print(f"Port {port} Check")
    print("=" * 60)

    if sys.platform == 'win32':
        result = subprocess.run(
            f'netstat -ano | findstr ":{port}"',
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
    else:
        result = subprocess.run(
            f'lsof -i :{port}',
            shell=True,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

    if result.stdout.strip():
        print(f"[WARN] Port {port} is occupied:")
        print(result.stdout)

        # 提取PID并查询进程名
        pids = set()
        for line in result.stdout.strip().split('\n'):
            parts = line.split()
            if sys.platform == 'win32':
                # Windows netstat: Proto LocalAddr ForeignAddr State PID
                if len(parts) >= 5:
                    pid = parts[-1].strip()
                    if pid.isdigit():
                        pids.add(pid)
            else:
                # lsof: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
                if len(parts) >= 2 and parts[1].isdigit():
                    pids.add(parts[1])

        if pids:
            print("\n占用端口的进程详情:")
            for pid in sorted(pids):
                name = get_process_name(pid)
                if name:
                    print(f"  PID {pid}: {name}")
                else:
                    print(f"  PID {pid}: (无法获取进程名)")

            print(f"\n清理建议:")
            if sys.platform == 'win32':
                print(f"  taskkill /PID {' /PID '.join(sorted(pids))} /F")
            else:
                print(f"  kill -9 {' '.join(sorted(pids))}")
            print(f"  或在插件设置页面点击 '清理残留进程' 按钮")

        return False
    else:
        print(f"[OK] Port {port} is available")
        return True

def check_service_files():
    print("\n" + "=" * 60)
    print("Service Files Check")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    required_files = [
        "main.py",
        "ocr_service.py",
        "requirements.txt",
        "api/__init__.py",
        "api/routers/__init__.py",
        "api/routers/ocr.py",
        "api/models.py",
    ]

    all_exist = True
    for file_path in required_files:
        full_path = os.path.join(base_dir, file_path)
        if os.path.exists(full_path):
            print(f"[OK] {file_path}")
        else:
            print(f"[FAIL] {file_path} not found")
            all_exist = False

    return all_exist

def main():
    # 从命令行参数或环境变量读取端口
    port = 8766
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    elif os.environ.get("HTTP_PORT", "").isdigit():
        port = int(os.environ["HTTP_PORT"])

    print("\n")
    print("+" + "=" * 58 + "+")
    print("|" + " " * 15 + "OCR Service Diagnostics" + " " * 22 + "|")
    print("+" + "=" * 58 + "+")

    checks = [
        ("Python Version", check_python_version()),
        ("Service Files", check_service_files()),
        ("Dependencies", check_dependencies()),
        ("Port Check", check_port(port)),
    ]

    print("\n" + "=" * 60)
    print("Diagnostics Summary")
    print("=" * 60)

    all_passed = True
    for check_name, result in checks:
        status = "[OK] Passed" if result else "[FAIL] Failed"
        print(f"{check_name}: {status}")
        if not result:
            all_passed = False

    print("\n" + "=" * 60)
    if all_passed:
        print("All checks passed! Service should start normally.")
    else:
        print("Some checks failed. Please resolve the issues above.")
        print("\n快速修复:")
        print("  1. 在插件设置页面点击 '安装依赖' 按钮")
        print("  2. 或手动运行: python install_deps.py --force")
        print("  3. 如果仍然失败, 请检查网络连接")
    print("=" * 60)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
