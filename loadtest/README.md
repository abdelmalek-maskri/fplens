# Load testing

The squad endpoint is the only one that forwards a caller's input to a third
party, so it is the only one worth loading. These tests drive it against a
local stand-in, never the real FPL API.

## Why a stand-in

Pointing a load generator at `fantasy.premierleague.com` is a denial of service
attempt against someone else's servers from an IP we do not own. `fake_fpl.py`
serves the same three endpoints with a settable latency, and a
`bootstrap-static` padded to roughly the real 1.8MB because its size is part of
what is being measured.

`FPL_BASE_URL` is read from the environment for this reason. **Check that it is
set before every run.** Reverting the file that reads it is enough to send the
whole run at the real FPL, which has happened.

## Running

Three terminals:

```bash
uvicorn loadtest.fake_fpl:app --port 8001                          # stand-in
FPL_BASE_URL=http://127.0.0.1:8001 uvicorn api.main:app --port 8000  # the API
python3 -m loadtest.run --concurrency 60 --requests 300            # the load
```

Confirm the traffic landed where you meant it to:

```bash
curl -s http://127.0.0.1:8001/_hits
```

An empty result means the API was talking to the real FPL. Stop and fix it.

Each virtual user asks for a different FPL ID, because an ID already in the
cache costs nothing upstream and would measure the cache rather than the server.

## Results

### Fetching bootstrap once an hour instead of once per squad

60 concurrent, 300 requests, stand-in at 300ms per call.

| | before | after |
| --- | --- | --- |
| throughput | 26.2 req/s | 43.4 req/s |
| p50 | 1779 ms | 1205 ms |
| p95 | 3324 ms | 2364 ms |
| p99 | 3333 ms | 2379 ms |
| bootstrap fetches | 299 | 1 |
| pulled from FPL | ~457 MB | ~1.5 MB |

A squad request reads the gameweek list out of `bootstrap-static` and nothing
else. Fetching it per squad made the largest payload in the system the slowest
part of a request that does not need it fresh.

### The threadpool ceiling

Both handlers are sync `def`, so FastAPI runs them in an anyio threadpool of 40.
With the stand-in at 2s per call and two sequential calls per request, 40
threads predicts a hard ceiling near 10 req/s.

120 concurrent squad requests:

```
wall clock          13.2s
throughput           9.1 req/s      (40 threads / 4s per request = 10)
succeeded          120/120

/api/health worst  12444 ms         it touches no network at all
```

Two things to take from that. The measured 9.1 req/s matches the predicted
ceiling, so the threadpool really is the limit rather than CPU or the upstream.

And **the health check lies**. `/api/health` reads a dict and returns, yet it
took 12.4 seconds because every thread was blocked on a socket. Any monitor
with a timeout under 12s reports the service as down; any monitor without one
reports it as healthy while it serves nothing. That is the case for making the
handlers async, and this is the number to beat.
