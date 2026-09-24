"""Dev server with caching off — the preview must always show the current file."""
import http.server, sys

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
