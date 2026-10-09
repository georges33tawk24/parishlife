"""Run backend/test_*.py against the Cloudflare Worker logic instead of server.py."""
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'cloudflare' / 'test' / 'pyshim'))
import server  # noqa: E402  (the shim, imported before the tests import "server")

assert Path(server.__file__).parent.name == 'pyshim', server.__file__
suite = unittest.defaultTestLoader.discover(str(REPO / 'backend'), pattern=sys.argv[1] if len(sys.argv) > 1 else 'test_*.py', top_level_dir=str(REPO / 'backend'))
result = unittest.TextTestRunner(verbosity=1).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
