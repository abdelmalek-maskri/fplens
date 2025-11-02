.PHONY: api.run web.dev test

api.run:
	cd api && uvicorn main:app --reload --port 8000

web.dev:
	cd app && npm run dev

test:
	cd api && pytest -q
