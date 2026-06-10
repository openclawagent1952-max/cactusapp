#!/bin/bash
# PythonAnywhere Deployment Script for Cactus Weather Advisor

echo "=== Cactus Weather Advisor - PythonAnywhere Deploy ==="
echo ""
echo "Step 1: Open https://www.pythonanywhere.com/"
echo "Step 2: Sign up or log in"
echo "Step 3: Open a Bash console (from the Consoles tab)"
echo ""
echo "Step 4: In the Bash console, run these commands:"
echo ""
cat << 'EOF'
# Clone your repo
git clone https://github.com/openclawagent1952-max/cactusweatherapp.git
cd cactusweatherapp

# Install dependencies
pip install --user -r requirements.txt

# Verify installation
python -c "from web.app import app; print('App loaded successfully!')"
EOF

echo ""
echo "Step 5: Go to the Web tab"
echo "Step 6: Click 'Add a new web app'"
echo "Step 7: Select 'Manual configuration'"
echo "Step 8: Select Python 3.9"
echo ""
echo "Step 9: In the Code section, set these paths:"
echo "  Source code: /home/openclawagent1952-max/cactusweatherapp"
echo "  Working directory: /home/openclawagent1952-max/cactusweatherapp"
echo ""
echo "Step 10: Click WSGI configuration file and replace with:"
cat << 'EOF'
import sys
import os

# Add project to path
path = '/home/openclawagent1952-max/cactusweatherapp'
if path not in sys.path:
    sys.path.insert(0, path)

# Import Flask app
from web.app import app as application
EOF

echo ""
echo "Step 11: Click 'Reload' button"
echo ""
echo "Your app will be live at:"
echo "https://openclawagent1952-max.pythonanywhere.com"
echo ""
echo "Done! 🌵☁️"