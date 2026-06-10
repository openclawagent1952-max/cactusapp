import sys
import os

# Get the directory containing this file (pythonanywhere_wsgi.py)
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Add project to Python path
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Also add web directory
WEB_DIR = os.path.join(PROJECT_DIR, 'web')
if WEB_DIR not in sys.path:
    sys.path.insert(0, WEB_DIR)

# Import Flask app
from web.app import app as application