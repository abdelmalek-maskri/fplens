"""Keep the test suite out of Sentry.

api.main calls load_dotenv() at import, so a developer with a real DSN in .env
would otherwise report every deliberately-triggered error in these tests to the
production project. conftest is imported before any test module, which is early
enough to win.
"""

import os

os.environ["SENTRY_DSN"] = ""
