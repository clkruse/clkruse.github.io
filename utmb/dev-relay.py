#!/usr/bin/env python3
"""
Local dev server for the UTMB tracker.

Serves the site root as static files AND relays the UTMB Live API at
/proxy?url=<encoded upstream url>, adding the X-Tenant header the API needs
and CORS headers the browser needs. index.html uses it automatically when
opened from localhost.

    python3 utmb/dev-relay.py          # then open http://localhost:8787/utmb/

In production the same job is done by proxy-worker.js (Cloudflare Worker).
"""
import gzip
import http.server
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
ALLOWED = {"utmblive-api.utmb.world", "livetrailv3.s3.gra.io.cloud.ovh.net"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):   # keep the terminal quiet
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != "/proxy":
            return super().do_GET()
        target = (urllib.parse.parse_qs(u.query).get("url") or [""])[0]
        if urllib.parse.urlparse(target).hostname not in ALLOWED:
            return self._send(400, b'{"error":"host not allowed"}')
        req = urllib.request.Request(target, headers={
            "X-Tenant": self.headers.get("X-Tenant", "utmb_2026"),
            "Content-Type": "application/json",
            "Accept-Encoding": "identity",
            "User-Agent": "utmb-tracker dev relay",
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body, code, ct = r.read(), r.status, r.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            body, code, ct = e.read(), e.code, e.headers.get("Content-Type", "application/json")
        except Exception as e:  # network trouble → tell the page, don't crash
            body, code, ct = ('{"error":"%s"}' % str(e).replace('"', "'")).encode(), 502, "application/json"
        if body[:2] == b"\x1f\x8b":          # the S3 track file is served pre-gzipped
            try:
                body = gzip.decompress(body)
            except Exception:
                pass
        self._send(code, body, ct)

    def _send(self, code, body, ct="application/json"):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    print(f"serving {ROOT} + relay on http://localhost:{PORT}/utmb/  (Ctrl-C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
