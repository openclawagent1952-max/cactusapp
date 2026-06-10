# Production entry point for deployment
# Usage: gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app

import sys
import os

# Add web directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'web'))

from web.app import app

if __name__ == "__main__":
    app.run()