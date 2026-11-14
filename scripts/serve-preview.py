#!/usr/bin/env python3
"""Превью-сервер: раздаёт out/ по префиксу /tab/ — как GitHub Pages project site."""
import http.server
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "out")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.abspath(OUT), **kwargs)

    def do_GET(self):
        # /tab/... → путь внутри out/
        self.path = self.path[len("/tab") :] or "/"
        if not os.path.exists(os.path.join(os.path.abspath(OUT), self.path.lstrip("/").split("?")[0])):
            self.path = "/404.html"
        super().do_GET()

    def translate_path(self, path):
        return super().translate_path(path)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
