# Minimal WSGI entry point for PythonAnywhere
import sys
import os

# Add paths
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# Import and expose Flask app
from web.app import app

# For WSGI
application = app