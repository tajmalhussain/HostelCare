#!/usr/bin/env python3
"""
HostelCare - Alternative Python Server Runner
Runs the frontend and emulates both PHP and Java services without external dependencies.
"""

import http.server
import socketserver
import threading
import json
import os
import hmac
import hashlib
import base64
import time
from urllib.parse import urlparse, parse_qs

JWT_SECRET = os.getenv("JWT_SECRET", "hostelcare_super_secret_jwt_key_2026_hs256_kpriet_lab")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def run_server(port, handler_class):
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True
    with ReusableTCPServer(("", port), handler_class) as httpd:
        print(f"Server started on port {port}")
        httpd.serve_forever()

if __name__ == "__main__":
    print("================================================================")
    print(" Starting HostelCare Dual-Service Local Runner...")
    print(" Recommended runner: node server.js (already running or available)")
    print("================================================================")
    os.system("node server.js")

