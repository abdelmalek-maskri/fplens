"""Drive the squad endpoint at a fixed concurrency and report what came back.

Each virtual user asks for a different FPL ID, because an ID the cache already
holds costs nothing upstream and would measure the cache rather than the server.

    python3 -m loadtest.run --concurrency 60 --requests 300

Reports p50/p95/p99, throughput and the error split, then asks the stand-in how
many calls it actually received, which is the number that shows whether
caching above it is doing its job.
"""

import argparse
import asyncio
import time

import httpx

API = "http://127.0.0.1:8000"
FAKE_FPL = "http://127.0.0.1:8001"


async def one(client: httpx.AsyncClient, fpl_id: int) -> tuple[float, int | str]:
    start = time.perf_counter()
    try:
        r = await client.get(f"{API}/api/team/{fpl_id}")
        return time.perf_counter() - start, r.status_code
    except httpx.TimeoutException:
        return time.perf_counter() - start, "timeout"
    except httpx.HTTPError as e:
        return time.perf_counter() - start, type(e).__name__


async def main(concurrency: int, total: int, timeout: float) -> None:
    async with httpx.AsyncClient(timeout=5) as admin:
        await admin.post(f"{FAKE_FPL}/_reset")

    sem = asyncio.Semaphore(concurrency)
    limits = httpx.Limits(max_connections=concurrency + 10)

    async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:

        async def guarded(fpl_id: int):
            async with sem:
                return await one(client, fpl_id)

        started = time.perf_counter()
        results = await asyncio.gather(*(guarded(i) for i in range(1, total + 1)))
        elapsed = time.perf_counter() - started

    latencies = sorted(d for d, _ in results)
    outcomes: dict[int | str, int] = {}
    for _, status in results:
        outcomes[status] = outcomes.get(status, 0) + 1

    def pct(p: float) -> float:
        return latencies[min(int(len(latencies) * p), len(latencies) - 1)]

    async with httpx.AsyncClient(timeout=5) as admin:
        hits = (await admin.get(f"{FAKE_FPL}/_hits")).json()

    print(f"concurrency {concurrency}, {total} requests in {elapsed:.1f}s")
    print(f"  throughput   {total / elapsed:6.1f} req/s")
    print(f"  p50          {pct(0.50) * 1000:6.0f} ms")
    print(f"  p95          {pct(0.95) * 1000:6.0f} ms")
    print(f"  p99          {pct(0.99) * 1000:6.0f} ms")
    print(f"  outcomes     {outcomes}")
    print(f"  upstream FPL {hits}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--concurrency", type=int, default=60)
    ap.add_argument("--requests", type=int, default=300)
    ap.add_argument("--timeout", type=float, default=60.0)
    args = ap.parse_args()
    asyncio.run(main(args.concurrency, args.requests, args.timeout))
