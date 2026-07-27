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
    for module_name, symbols in [
        ('fastapi', ['FastAPI']),
        ('uvicorn', ['run']),
        ('pydantic', ['BaseModel']),
        ('PIL', ['Image']),
    ]:
        try:
            mod = __import__(module_name)
            if getattr(mod, '__file__', None) is None:
                missing.append(f"{module_name} (corrupted: namespace package)")
                continue
            for sym in symbols:
                if not hasattr(mod, sym):
                    missing.append(f"{module_name} (missing {sym})")
                    break
        except ImportError:
            missing.append(f"{module_name} (not installed)")
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


def run_http_server(host: str = "127.0.0.1", port: int = 8766):
    logger.info(f"启动 OCR 服务: http://{host}:{port}")
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")


def main():
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("HTTP_PORT", "8766"))
    run_http_server(host, port)


if __name__ == "__main__":
    main()
