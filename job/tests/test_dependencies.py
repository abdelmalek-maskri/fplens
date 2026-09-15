"""The job runs with requirements-job.txt alone.

CI installs the API's requirements too, so an accidental import of a serving
dependency passes every test and only fails in the scheduled workflow. That is
exactly what happened when solvers.py moved here still importing fastapi.
"""

import ast
from pathlib import Path

JOB = Path(__file__).resolve().parent.parent

# Installed for serving, not for the job. requirements-job.txt has none of these.
SERVING_ONLY = {"fastapi", "starlette", "uvicorn"}


def _imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text())
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names.add(node.module.split(".")[0])
    return names


def test_job_does_not_import_serving_dependencies():
    offenders = {}
    for f in JOB.glob("*.py"):
        bad = _imported_modules(f) & SERVING_ONLY
        if bad:
            offenders[f.name] = sorted(bad)

    assert not offenders, (
        f"job/ imports serving-only packages: {offenders}. "
        "requirements-job.txt does not install them, so the snapshot workflow will fail."
    )
