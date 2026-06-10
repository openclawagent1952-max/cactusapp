# Cactus Weather Advisor - Deployment Guide

## Quick Deploy Options

### Option 1: PythonAnywhere (Easiest, Free)

1. Sign up at https://www.pythonanywhere.com/
2. Open Bash console
3. Run:
```bash
git clone https://github.com/YOUR_USERNAME/cactus-weather-advisor.git
cd cactus-weather-advisor
pip install -r requirements.txt
```
4. Go to Web tab → Create new web app
5. Choose Manual configuration → Python 3.9
6. Set WSGI file to:
```python
import sys
path = '/home/YOUR_USERNAME/cactus-weather-advisor'
if path not in sys.path:
    sys.path.append(path)

from web.app import app as application
```
7. Set working directory to `/home/YOUR_USERNAME/cactus-weather-advisor`
8. Reload web app

URL: `https://YOUR_USERNAME.pythonanywhere.com`

---

### Option 2: Render (Free Tier)

1. Push code to GitHub
2. Sign up at https://render.com/
3. Create New Web Service → Connect GitHub repo
4. Settings:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 4 -b 0.0.0.0:$PORT wsgi:app`
   - **Environment:** Python 3
5. Deploy

URL: `https://cactus-weather-XXXX.onrender.com`

---

### Option 3: Railway (Free Tier)

1. Push code to GitHub
2. Sign up at https://railway.app/
3. New Project → Deploy from GitHub repo
4. Railway auto-detects Python/Flask
5. Add environment variable: `PORT=5000`

URL: `https://cactus-weather-XXXX.up.railway.app`

---

## Files Structure for Deployment

```
cactus-weather-advisor/
├── requirements.txt          # Dependencies
├── wsgi.py                  # Production entry point
├── web/
│   ├── app.py              # Main Flask app
│   ├── templates/
│   │   └── index.html
│   └── static/
│       ├── css/style.css
│       └── js/app.js
```

## Environment Variables

Optional settings via environment variables:

```bash
FLASK_DEBUG=false    # Set to true for development
PORT=5001           # Port to run on (default: 5001)
```

## Testing Locally Before Deploy

```bash
# Install dependencies
pip install -r requirements.txt

# Run with production settings
FLASK_DEBUG=false python web/app.py

# Or use gunicorn (production server)
gunicorn -w 4 -b 0.0.0.0:8000 wsgi:app
```

## Custom Domain (Optional)

All platforms support custom domains:
- PythonAnywhere: Web tab → Add domain
- Render: Settings → Custom Domain
- Railway: Settings → Custom Domain

## Troubleshooting

**Issue:** App won't start  
**Fix:** Check `requirements.txt` has all dependencies

**Issue:** Static files not loading  
**Fix:** Ensure `static/` folder is in repo root, not gitignored

**Issue:** Template not found  
**Fix:** Verify `templates/` folder is in `web/` directory

**Issue:** API calls fail  
**Fix:** Open-Meteo API has no key required - should work everywhere

---

## Recommended: PythonAnywhere (Free & Reliable)

**Why PythonAnywhere?**
- Always free tier available
- Easy Flask deployment
- Custom domains supported
- No sleep/idle timeout (unlike Render/Railway)
- Console access for debugging

**Sign up:** https://www.pythonanywhere.com/registration/complete/