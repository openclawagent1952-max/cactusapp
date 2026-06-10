"""
Cactus Weather Advisor - Phase 1 MVP
Auto-detects Metric vs Imperial based on location
"""

from flask import Flask, render_template, jsonify, request
import requests
import json
import os
import re
from datetime import datetime

app = Flask(__name__)

# Countries that use Fahrenheit (very few)
FAHRENHEIT_COUNTRIES = {'United States', 'Liberia', 'Myanmar', 'Bahamas', 'Belize', 'Cayman Islands'}

# Core 3 Species Database - Stored in Celsius
SPECIES_DB = {
    "pachanoi": {
        "common_names": ["San Pedro"],
        "notes": "Most forgiving, humidity-tolerant.",
        "origin": "Ecuador/Peru Andes",
        "temp_optimal_c": {"day_min": 21, "day_max": 29},
        "temp_critical_c": {"frost_threshold": 0, "heat_stress": 35},
        "humidity_optimal": {"min": 30, "max": 80},
    },
    "peruvianus": {
        "common_names": ["Peruvian Torch"],
        "notes": "More rot-prone, needs drainage.",
        "origin": "Peru highlands",
        "temp_optimal_c": {"day_min": 18, "day_max": 29},
        "temp_critical_c": {"frost_threshold": 0, "heat_stress": 38},
        "humidity_optimal": {"min": 30, "max": 60},
    },
    "bridgesii": {
        "common_names": ["Bolivian Torch"],
        "notes": "Fastest grower, most cold-hardy.",
        "origin": "Bolivia highlands",
        "temp_optimal_c": {"day_min": 21, "day_max": 29},
        "temp_critical_c": {"frost_threshold": 0, "heat_stress": 32},
        "humidity_optimal": {"min": 30, "max": 70},
    }
}


def c_to_f(c):
    return round((c * 9/5) + 32)


def f_to_c(f):
    return round((f - 32) * 5/9)


def get_unit_config(country):
    """Return unit config based on country"""
    if country in FAHRENHEIT_COUNTRIES:
        return {
            "temp_unit": "fahrenheit",
            "speed_unit": "mph", 
            "precip_unit": "inch",
            "use_fahrenheit": True,
            "temp_symbol": "°F",
            "speed_symbol": "mph",
            "precip_symbol": "\""
        }
    else:
        return {
            "temp_unit": "celsius",
            "speed_unit": "kmh",
            "precip_unit": "mm",
            "use_fahrenheit": False,
            "temp_symbol": "°C",
            "speed_symbol": "km/h",
            "precip_symbol": "mm"
        }


def get_species_data(species_key, use_fahrenheit):
    """Get species with correct units"""
    sp = SPECIES_DB[species_key].copy()
    
    if use_fahrenheit:
        sp["temp_optimal"] = {
            "day_min": c_to_f(sp["temp_optimal_c"]["day_min"]),
            "day_max": c_to_f(sp["temp_optimal_c"]["day_max"])
        }
        sp["temp_critical"] = {
            "frost_threshold": c_to_f(sp["temp_critical_c"]["frost_threshold"]),
            "heat_stress": c_to_f(sp["temp_critical_c"]["heat_stress"])
        }
    else:
        sp["temp_optimal"] = sp["temp_optimal_c"]
        sp["temp_critical"] = sp["temp_critical_c"]
    
    return sp


def geocode_location(location_str):
    """Geocode with country detection for unit selection"""
    try:
        original = location_str.strip()
        normalized = original
        
        # Normalize US state formats
        us_state_codes = {'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'}
        
        # "Denver CO" -> "Denver, CO"
        match = re.match(r'^(.*?)\s+([A-Z]{2})$', normalized.upper())
        if match and match.group(2) in us_state_codes:
            normalized = f"{match.group(1).strip().title()}, {match.group(2)}"
        
        search_terms = [normalized, original, original.split(',')[0].strip()]
        seen = set()
        
        for term in search_terms:
            term_lower = term.lower()
            if term_lower in seen or len(term) < 2:
                continue
            seen.add(term_lower)
            
            url = "https://geocoding-api.open-meteo.com/v1/search"
            resp = requests.get(url, params={"name": term.replace(' ', '+'), "count": 5, "language": "en"}, timeout=10)
            data = resp.json()
            
            if "results" in data and data["results"]:
                for result in data["results"]:
                    result_type = result.get("feature_code", "")
                    country = result.get("country", "")
                    
                    # Skip countries/regions, only cities
                    if result_type in ["PCLI", "PCLD", "PCLF", "TERR", "CONT"]:
                        continue
                    if not result_type.startswith("PPL") and result_type not in ["ADM2", "ADM3", "ADM4"]:
                        continue
                    
                    # Format display name
                    admin1 = result.get("admin1", "")
                    if country == "United States" and admin1:
                        display_name = f"{result.get('name', term)}, {admin1}"
                    else:
                        display_name = f"{result.get('name', term)}, {country}"
                    
                    return {
                        "lat": result["latitude"],
                        "lon": result["longitude"],
                        "name": display_name,
                        "country": country,
                        "use_fahrenheit": country in FAHRENHEIT_COUNTRIES
                    }
        return None
    except Exception as e:
        print(f"Geocode error: {e}")
        return None


def get_weather(lat, lon, use_fahrenheit):
    """Get weather with correct units"""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        units = get_unit_config("United States" if use_fahrenheit else "Other")
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,weather_code,cloudcover_mean,windspeed_10m_max",
            "current": "temperature_2m,relative_humidity_2m,windspeed_10m",
            "forecast_days": 7,
            "temperature_unit": units["temp_unit"],
            "windspeed_unit": units["speed_unit"],
            "precipitation_unit": units["precip_unit"]
        }
        
        resp = requests.get(url, params=params, timeout=10)
        return resp.json()
    except Exception as e:
        print(f"Weather error: {e}")
        return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/species")
def get_species():
    """Return species with units based on requested location"""
    # Default to Fahrenheit unless specified
    use_fahrenheit = request.args.get("units", "auto") != "metric"
    
    species_list = []
    for key, data in SPECIES_DB.items():
        sp = get_species_data(key, use_fahrenheit)
        species_list.append({
            "key": f"trichocereus_{key}",
            "name": data["common_names"][0],
            "preferred_params": {
                "temp_day_range": [sp["temp_optimal"]["day_min"], sp["temp_optimal"]["day_max"]],
                "frost_threshold": sp["temp_critical"]["frost_threshold"],
                "heat_stress": sp["temp_critical"]["heat_stress"],
                "humidity_range": [data["humidity_optimal"]["min"], data["humidity_optimal"]["max"]]
            },
            "temp_symbol": "°F" if use_fahrenheit else "°C"
        })
    
    return jsonify({"species": species_list})


@app.route("/api/forecast")
def get_forecast():
    location = request.args.get("location", "Tampa")
    species_list = request.args.get("species", "pachanoi").split(",")
    
    # Geocode
    loc_data = geocode_location(location)
    if not loc_data:
        return jsonify({"error": "Location not found"}), 404
    
    use_fahrenheit = loc_data["use_fahrenheit"]
    units = get_unit_config("United States" if use_fahrenheit else "Other")
    
    # Get weather
    weather = get_weather(loc_data["lat"], loc_data["lon"], use_fahrenheit)
    if not weather:
        return jsonify({"error": "Weather unavailable"}), 503
    
    # Parse current
    current_data = weather.get("current", {})
    current = {
        "temp": current_data.get("temperature_2m", 20),
        "humidity": current_data.get("relative_humidity_2m", 50),
        "wind": current_data.get("windspeed_10m", 0),
        "cloudcover": current_data.get("cloudcover", 0),
        "weather_code": current_data.get("weather_code", 0),
        "location": {"city": loc_data["name"], "region": loc_data["country"]},
        "temp_symbol": units["temp_symbol"],
        "speed_symbol": units["speed_symbol"]
    }
    
    # Build advisories
    daily_advisories = []
    daily = weather.get("daily", {})
    
    for i in range(len(daily.get("time", []))):
        day_max = daily["temperature_2m_max"][i]
        day_min = daily["temperature_2m_min"][i]
        humidity = daily["relative_humidity_2m_mean"][i]
        precip = daily.get("precipitation_sum", [0]*7)[i]
        
        day_data = {
            "date": daily["time"][i],
            "day_of_week": datetime.strptime(daily["time"][i], "%Y-%m-%d").strftime("%A"),
            "temp_max": day_max,
            "temp_min": day_min,
            "humidity": humidity,
            "precipitation": precip,
            "wind": daily.get("windspeed_10m_max", [0]*7)[i],
            "cloudcover": daily.get("cloudcover_mean", [0]*7)[i],
            "weather_code": daily.get("weather_code", [0]*7)[i],
            "temp_symbol": units["temp_symbol"],
            "speed_symbol": units["speed_symbol"],
            "precip_symbol": units["precip_symbol"]
        }
        
        # Analyze for each species
        species_exceptions = {}
        for sp in species_list:
            if sp in SPECIES_DB:
                sp_data = get_species_data(sp, use_fahrenheit)
                exceptions = []
                
                frost_thresh = sp_data["temp_critical"]["frost_threshold"]
                heat_thresh = sp_data["temp_critical"]["heat_stress"]
                hum_min = sp_data["humidity_optimal"]["min"]
                hum_max = sp_data["humidity_optimal"]["max"]
                
                # Frost (3° buffer)
                if day_min < frost_thresh + (3 if use_fahrenheit else 2):
                    if day_min < frost_thresh:
                        exceptions.append(f"❄️ CRITICAL: {day_min}{units['temp_symbol']} below frost threshold ({frost_thresh}{units['temp_symbol']})")
                    else:
                        exceptions.append(f"❄️ Frost warning: Approaching {frost_thresh}{units['temp_symbol']}")
                
                # Heat
                if day_max > heat_thresh:
                    exceptions.append(f"🔥 Heat stress: {day_max}{units['temp_symbol']} exceeds {heat_thresh}{units['temp_symbol']}")
                
                # Humidity
                if humidity > hum_max + 5:
                    exceptions.append(f"💧 High humidity ({humidity}%): exceeds {hum_max}%")
                elif humidity < hum_min - 5:
                    exceptions.append(f"💧 Low humidity ({humidity}%): below {hum_min}%")
                
                if exceptions:
                    species_exceptions[sp] = {
                        "common_name": sp_data["common_names"][0],
                        "exceptions": exceptions
                    }
        
        day_data["species_exceptions"] = species_exceptions
        day_data["risk_level"] = "danger" if any("❄️ CRITICAL" in str(e) for e in species_exceptions.values()) else "caution" if species_exceptions else "optimal"
        
        # Generate daily note
        note_parts = []
        if day_max > (90 if use_fahrenheit else 32):
            note_parts.append(f"Hot day ahead ({day_max}{units['temp_symbol']}).")
        elif day_max > (80 if use_fahrenheit else 27):
            note_parts.append(f"Warm day ({day_max}{units['temp_symbol']}).")
        else:
            note_parts.append(f"Mild day ({day_max}{units['temp_symbol']}).")
        
        if precip > (0.2 if use_fahrenheit else 5):
            note_parts.append(f"Rain expected ({precip}{units['precip_symbol']}). Skip watering.")
        elif precip > 0:
            note_parts.append(f"Light rain ({precip}{units['precip_symbol']}). Check soil.")
        else:
            note_parts.append("No rain. Water if soil is dry.")
        
        day_data["daily_note"] = " ".join(note_parts)
        daily_advisories.append(day_data)
    
    return jsonify({
        "current": current,
        "daily_advisories": daily_advisories,
        "location": loc_data,
        "units": units
    })


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=debug, host="0.0.0.0", port=port)
