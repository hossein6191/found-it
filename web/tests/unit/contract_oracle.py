"""The contract itself, asked from node: tests/unit/oracle.mjs runs this with python3 and a JSON request on stdin.

A stub stands in for the GenLayer runtime (no network, nothing installed), contracts/found_it.py is loaded
as it is, and only its pure parts are asked: rules(), the seal, and the readers of the doors. The answer is
one JSON object on stdout.
"""

import importlib.util
import json
import pathlib
import sys
import types

stub = types.ModuleType("genlayer")


class _Any:
    def __getattr__(self, n): return _Any()
    def __call__(self, *a, **k): return _Any()
    def __getitem__(self, n): return _Any()


class _UserError(Exception):
    pass


class _VM:
    UserError = _UserError
    Return = object
    Result = object


class _Public:
    view = staticmethod(lambda f: f)

    class _Write:
        def __call__(self, f): return f
        payable = staticmethod(lambda f: f)
    write = _Write()


class _GL:
    vm = _VM()
    public = _Public()

    class Contract:
        pass

    evm = _Any()

    def __getattr__(self, n): return _Any()


class _T:
    def __init__(self, *a, **k): pass
    def __class_getitem__(cls, item): return cls


stub.gl = _GL()
stub.allow_storage = lambda c: c
stub.Address = str
stub.DynArray = _T
stub.TreeMap = _T
stub.u256 = int
stub.u32 = int
stub.u64 = int
stub.i64 = int
stub.__all__ = ["gl", "allow_storage", "Address", "DynArray", "TreeMap", "u256", "u32", "u64", "i64"]
sys.modules["genlayer"] = stub

SRC = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "found_it.py"
spec = importlib.util.spec_from_file_location("found_it", SRC)
fi = importlib.util.module_from_spec(spec)
sys.modules["found_it"] = fi
spec.loader.exec_module(fi)

ask = json.loads(sys.stdin.read() or "{}")
out = {}
if ask.get("rules"):
    out["rules"] = json.loads(fi.FoundIt.rules(None))
if ask.get("why"):
    out["why"] = dict(fi.WHY)
out["seal"] = [fi._seal(m, s) for m, s in ask.get("seal", [])]
out["text_problem"] = [fi._text_problem(r, a, b, w) for r, a, b, w in ask.get("text_problem", [])]
out["digest_of"] = [fi._digest_of(r) for r in ask.get("digest_of", [])]
out["is_salt"] = [fi._is_salt(r) for r in ask.get("is_salt", [])]
out["whole"] = [fi._whole(r) for r in ask.get("whole", [])]
out["is_id"] = [fi._is_id(t, p) for t, p in ask.get("is_id", [])]
sys.stdout.write(json.dumps(out))
