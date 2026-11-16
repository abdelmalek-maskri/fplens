"""The retry behaviour on the ~800 FPL calls a snapshot makes.

Run against a real local HTTP server rather than a mocked adapter, because
the retrying happens inside urllib3 and a mock at the requests layer would
assert that the configuration exists rather than that it works.
"""

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from job.fetch_live_data import RETRY_TOTAL, fpl_session

# path -> list of statuses to return, one per request, last one repeating.
SCRIPT: dict[str, list[int]] = {}
HITS: dict[str, int] = {}


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802  (BaseHTTPRequestHandler's own naming)
        path = self.path
        HITS[path] = HITS.get(path, 0) + 1
        statuses = SCRIPT.get(path, [200])
        status = statuses[min(HITS[path] - 1, len(statuses) - 1)]
        body = b'{"ok":true}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        """Silence the default stderr access log."""


@pytest.fixture
def server():
    SCRIPT.clear()
    HITS.clear()
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()
    httpd.server_close()


def test_a_transient_failure_is_retried_until_it_succeeds(server):
    SCRIPT["/flaky"] = [503, 503, 200]
    resp = fpl_session().get(f"{server}/flaky", timeout=5)
    assert resp.status_code == 200
    assert HITS["/flaky"] == 3


def test_a_404_is_an_answer_and_is_not_retried(server):
    # Retrying would add seconds to the API's "FPL ID not found" response and
    # could not change the result.
    SCRIPT["/missing"] = [404]
    resp = fpl_session().get(f"{server}/missing", timeout=5)
    assert resp.status_code == 404
    assert HITS["/missing"] == 1


def test_a_429_is_retried_because_it_means_slow_down_not_no(server):
    SCRIPT["/throttled"] = [429, 200]
    resp = fpl_session().get(f"{server}/throttled", timeout=5)
    assert resp.status_code == 200
    assert HITS["/throttled"] == 2


def test_retries_stop_at_the_limit_and_the_last_response_is_returned(server):
    # raise_on_status=False, so callers keep their existing status checks
    # rather than suddenly having to catch a urllib3 exception.
    SCRIPT["/down"] = [503]
    resp = fpl_session().get(f"{server}/down", timeout=5)
    assert resp.status_code == 503
    assert HITS["/down"] == RETRY_TOTAL + 1


def test_a_healthy_call_is_made_exactly_once(server):
    SCRIPT["/fine"] = [200]
    assert fpl_session().get(f"{server}/fine", timeout=5).status_code == 200
    assert HITS["/fine"] == 1


def test_each_thread_gets_its_own_session():
    # fetch_all_player_histories runs twenty of these at once and
    # requests.Session is not documented as thread-safe.
    seen = {}

    def record(name):
        seen[name] = fpl_session()

    threads = [threading.Thread(target=record, args=(i,)) for i in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len({id(s) for s in seen.values()}) == 3


def test_the_same_thread_reuses_one_session():
    assert fpl_session() is fpl_session()
