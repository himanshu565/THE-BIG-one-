import sys
from pathlib import Path

import pytest

# Ensure backend directory is importable regardless of current working directory.
_BACKEND_DIR = str(Path(__file__).resolve().parent.parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.core.rate_limit import reset_rate_limiters


@pytest.fixture(autouse=True)
def _reset_rate_limiters_between_tests():
    """Reset in-memory sliding-window rate limiters before and after every test."""
    reset_rate_limiters()
    yield
    reset_rate_limiters()
