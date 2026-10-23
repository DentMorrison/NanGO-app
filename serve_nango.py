from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path
import os
import shutil

class RangeHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def send_head(self):
        path = self.translate_path(urlsplit(self.path).path)

        if os.path.isdir(path):
            return super().send_head()

        if not os.path.isfile(path):
            self.send_error(404, "Archivo no encontrado")
            return None

        size = os.path.getsize(path)
        start, end = 0, size - 1
        range_header = self.headers.get("Range")

        if range_header:
            try:
                unit, value = range_header.split("=", 1)
                if unit.strip() != "bytes" or "," in value:
                    raise ValueError()

                first, last = value.split("-", 1)

                if first:
                    start = int(first)
                    end = int(last) if last else size - 1
                else:
                    length = int(last)
                    start = max(0, size - length)
                    end = size - 1

                if size == 0 or start < 0 or start >= size or end < start:
                    raise ValueError()

                end = min(end, size - 1)
            except (ValueError, TypeError):
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None

        file = open(path, "rb")
        file.seek(start)
        length = end - start + 1

        self.send_response(206 if range_header else 200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", formatdate(os.path.getmtime(path), usegmt=True))

        if range_header:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")

        self.end_headers()
        self._range_length = length
        return file

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_range_length", None)
        if remaining is None:
            shutil.copyfileobj(source, outputfile)
        else:
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
            del self._range_length

if __name__ == "__main__":
    print("Ñango disponible en http://127.0.0.1:8000")
    print("Servidor compatible con solicitudes Range de PMTiles.")
    ThreadingHTTPServer(("127.0.0.1", 8000), RangeHandler).serve_forever()
