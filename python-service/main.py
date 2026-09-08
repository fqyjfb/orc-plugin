#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR 识别服务
基于 FastAPI 提供 OCR 文字识别 HTTP API
"""
import sys
import os

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def check_imports():
    missing = []
    checks = [
        ('fastapi', 'FastAPI'),
        ('uvicorn', 'run'),
        ('pydantic', 'BaseModel'),
    ]
    for module_name, symbol in checks:
        try:
            mod = __import__(module_name)
            if getattr(mod, '__file__', None) is None:
                missing.append(f"{module_name} (corrupted)")
                continue
            if not hasattr(mod, symbol):
                missing.append(f"{module_name} (missing {symbol})")
        except ImportError:
            missing.append(f"{module_name} (not installed)")

    try:
        from PIL import Image
        if getattr(Image, '__file__', None) is None:
            missing.append("PIL.Image (corrupted)")
    except ImportError:
        missing.append("PIL (not installed)")

    return missing

missing_deps = check_imports()
if missing_deps:
    logger.error(f"依赖检查失败: {', '.join(missing_deps)}")
    logger.error("请运行安装依赖: python install_deps.py --force")
    sys.exit(1)


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI(
    title="ToolBox OCR Service",
    description="OCR 文字识别服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


from api.routers.ocr import router as ocr_router
app.include_router(ocr_router)


def run_http_server(host: str = "127.0.0.1", port: int = 8766, max_retries: int = 20):
    import uvicorn
    import socket

    for attempt in range(max_retries):
        current_port = port + attempt
        try:
            # 预检端口是否可用
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
                s.bind((host, current_port))
        except OSError:
            logger.warning(f"端口 {current_port} 被占用，尝试下一个端口...")
            continue

        logger.info(f"启动 OCR 服务: http://{host}:{current_port}")
        try:
            uvicorn.run(app, host=host, port=current_port, log_level="info")
            return
        except OSError as e:
            err_str = str(e)
            if "10048" in err_str or "EADDRINUSE" in err_str or "Address already in use" in err_str:
                logger.warning(f"端口 {current_port} 绑定失败，尝试下一个端口...")
                continue
            raise

    logger.error(f"无法找到可用端口（尝试了 {port} - {port + max_retries - 1}）")
    sys.exit(1)


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("HTTP_PORT", "8766"))
    run_http_server(host, port)


if __name__ == "__main__":
    main()
