"""
Sacred Cactus Weather Advisor - Phase 1 MVP
Flask backend with Open-Meteo API integration
Fahrenheit only - no Celsius conversion
"""

from flask import Flask, render_template, jsonify, request
import requests
import json
import os
from datetime import datetime

app = Flask(__name__)

# Core 3 Species Database - Scientifically accurate parameters (Fahrenheit)
# Sources: Trout's Notes (troutsnotes.com), botanical field observations, USDA Zone data
SPECIES_DB = {
    "pachanoi": {
        "common_names": ["San Pedro"],
        "notes": "Most forgiving, humidity-tolerant. True pachanoi hardier than common pachanot clone.",
        "temp_optimal": {"day_min": 70, "day_max": 85, "night_min": 50, "night_max": 65},
        "temp_critical": {"frost_threshold": 32, "heat_stress": 95},
        "humidity_optimal": {"min": 30, "max": 80},
        "growth_rate": "fast",
        "origin": "Ecuador/Peru Andes, 6000-9000ft"
    },
    "peruvianus": {
        "common_names": ["Peruvian Torch"],
        "notes": "More rot-prone than pachanoi. Needs excellent drainage. Less forgiving.",
        "temp_optimal": {"day_min": 65, "day_max": 85, "night_min": 45, "night_max": 60},
        "temp_critical": {"frost_threshold": 32, "heat_stress": 100},
        "humidity_optimal": {"min": 30, "max": 60},
        "growth_rate": "moderate",
        "origin": "Peru highlands, 8000-10000ft"
    },
    "bridgesii": {
        "common_names": ["Bolivian Torch"],
        "notes": "Fastest grower when warm. Most cold-hardy of the three. Can handle brief frost.",
        "temp_optimal": {"day_min": 70, "day_max": 85, "night_min": 50, "night_max": 65},
        "temp_critical": {"frost_threshold": 32, "heat_stress": 90},
        "humidity_optimal": {"min": 30, "max": 70},
        "growth_rate": "fastest",
        "origin": "Bolivia highlands, 9000-11000ft"
    }
}


def geocode_location(location_str):
    """Convert location string to lat/lon using Open-Meteo geocoding"""
    try:
        clean_loc = location_str.strip().replace(' ', '+')
        url = "https://geocoding-api.open-meteo.com/v1/search"
        params = {"name": clean_loc, "count": 1, "language": "en"}
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        
        if "results" in data and data["results"]:
            result = data["results"][0]
            country = result.get("country", "")
            admin1 = result.get("admin1", "")  # State/Province
            
            # For US locations, include state; otherwise just country
            if country == "United States" and admin1:
                location_str = f"{result.get('name', location_str)}, {admin1}"
            else:
                location_str = result.get("name", location_str)
            
            return {
                "lat": result["latitude"],
                "lon": result["longitude"],
                "name": location_str,
                "country": country,
                "admin1": admin1
            }
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None


def get_weather(lat, lon):
    """Fetch 7-day forecast from Open-Meteo with full data - Fahrenheit only"""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,weather_code,cloudcover_mean,windspeed_10m_max",
            "current": "temperature_2m,relative_humidity_2m,windspeed_10m",
            "forecast_days": 7,
            "temperature_unit": "fahrenheit",
            "windspeed_unit": "mph",
            "precipitation_unit": "inch"
        }
        resp = requests.get(url, params=params, timeout=10)
        print(f"Weather API response keys: {list(resp.json().keys())}")
        return resp.json()
    except Exception as e:
        print(f"Weather API error: {e}")
        return None


def analyze_conditions(day_temp, night_temp, humidity, precip, species_key):
    """Generate simple daily note with exceptions for outliers"""
    sp = SPECIES_DB[species_key]
    species_name = sp["common_names"][0]
    
    # Determine growth phase
    if night_temp > 55:
        phase = "active"
    elif night_temp < 50:
        phase = "dormant"
    else:
        phase = "transition"
    
    # Check thresholds
    frost_threshold = sp["temp_critical"]["frost_threshold"]
    heat_threshold = sp["temp_critical"]["heat_stress"]
    humidity_min = sp["humidity_optimal"]["min"]
    humidity_max = sp["humidity_optimal"]["max"]
    
    # Build exceptions list (only things that matter) - within 3° of threshold
    exceptions = []
    
    # Frost risk - only warn when within 3° of threshold
    if night_temp < frost_threshold + 3:
        if night_temp < frost_threshold:
            exceptions.append(f"❄️ CRITICAL: {night_temp}° below frost threshold ({frost_threshold}°)")
        else:
            exceptions.append(f"❄️ Frost warning: {night_temp}° approaching {frost_threshold}° threshold")
    
    # Heat stress - only warn when exceeding threshold
    if day_temp > heat_threshold:
        exceptions.append(f"🔥 Heat stress: {day_temp}° exceeds {heat_threshold}° threshold")
    
    # Humidity exceptions - outside preferred range
    if humidity > humidity_max + 5:
        exceptions.append(f"💧 High humidity ({humidity}%): exceeds {humidity_max}% limit")
    elif humidity < humidity_min - 5:
        exceptions.append(f"💧 Low humidity ({humidity}%): below {humidity_min}% minimum")
    
    # Rot risk (cool + wet + humid)
    if night_temp < 50 and humidity > 70 and precip > 0.1:
        exceptions.append(f"🦠 Rot risk: Cool night ({night_temp}°) + rain + high humidity")
    
    return {
        "phase": phase,
        "exceptions": exceptions
    }


def generate_daily_note(day_data, selected_species):
    """Generate one daily note + species exceptions"""
    parts = []
    
    # Opening based on conditions
    if day_data["temp_max"] > 90:
        parts.append(f"Hot day ahead ({day_data['temp_max']:.0f}° high).")
    elif day_data["temp_max"] > 80:
        parts.append(f"Warm day ({day_data['temp_max']:.0f}° high).")
    elif day_data["temp_max"] > 70:
        parts.append(f"Mild day ({day_data['temp_max']:.0f}° high).")
    else:
        parts.append(f"Cool day ({day_data['temp_max']:.0f}° high).")
    
    # Humidity note
    humidity = day_data["humidity"]
    if humidity > 75:
        parts.append(f"High humidity ({humidity:.0f}%). Ensure good airflow.")
    elif humidity < 35:
        parts.append(f"Dry air ({humidity:.0f}%). Soil will dry faster.")
    
    # Precip
    if day_data["precipitation"] > 0.2:
        parts.append(f"Rain expected ({day_data['precipitation']:.2f}\"). Skip watering.")
    elif day_data["precipitation"] > 0:
        parts.append(f"Light rain possible ({day_data['precipitation']:.2f}\"). Check soil before watering.")
    else:
        parts.append("No rain. Water if soil is dry.")
    
    # All species in active growth?
    all_active = all(
        day_data["temp_min"] > 55 for sp in selected_species 
        if sp in SPECIES_DB
    )
    if all_active:
        parts.append("All species in active growth phase.")
    
    return " ".join(parts)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/species")
def get_species():
    """Return Core 3 species data - Fahrenheit only"""
    species_list = []
    for key, data in SPECIES_DB.items():
        species_list.append({
            "key": f"trichocereus_{key}",
            "name": data["common_names"][0],
            "notes": data.get("notes", ""),
            "preferred_params": {
                "temp_day_range": [data["temp_optimal"]["day_min"], data["temp_optimal"]["day_max"]],
                "frost_threshold": data["temp_critical"]["frost_threshold"],
                "heat_stress": data["temp_critical"]["heat_stress"],
                "humidity_range": [data["humidity_optimal"]["min"], data["humidity_optimal"]["max"]]
            }
        })
    return jsonify({"species": species_list})


@app.route("/api/forecast")
def get_forecast():
    """Get weather forecast and generate advisories - Fahrenheit only"""
    location = request.args.get("location", "Tampa")
    species_list = request.args.get("species", "pachanoi").split(",")
    
    # Geocode location
    loc_data = geocode_location(location)
    if not loc_data:
        return jsonify({"error": "Location not found"}), 404
    
    # Get weather
    weather = get_weather(loc_data["lat"], loc_data["lon"])
    if not weather:
        return jsonify({"error": "Weather data unavailable"}), 503
    
    # Check if we have current conditions
    if "current" not in weather:
        return jsonify({"error": "Weather data format error"}), 503
    
    # Parse current conditions - Fahrenheit only
    current_data = weather.get("current", {})
    current_values = current_data.get("values", {})
    current = {
        "temp": current_values.get("temperature_2m", current_data.get("temperature_2m", 70)),
        "humidity": current_values.get("relative_humidity_2m", current_data.get("relative_humidity_2m", 50)),
        "wind": current_values.get("windspeed_10m", current_data.get("windspeed_10m", 0)),
        "cloudcover": current_values.get("cloudcover", current_data.get("cloudcover", 0)),
        "weather_code": current_values.get("weather_code", current_data.get("weather_code", 0)),
        "location": {"city": loc_data["name"], "region": loc_data["country"]},
    }
    
    # Generate daily advisories
    daily_advisories = []
    daily = weather.get("daily", {})
    
    for i in range(len(daily.get("time", []))):
        day_data = {
            "date": daily["time"][i],
            "day_of_week": datetime.strptime(daily["time"][i], "%Y-%m-%d").strftime("%A"),
            "temp_max": daily["temperature_2m_max"][i],
            "temp_min": daily["temperature_2m_min"][i],
            "humidity": daily["relative_humidity_2m_mean"][i],
            "precipitation": daily.get("precipitation_sum", [0]*7)[i],
            "wind": daily.get("windspeed_10m_max", [0]*7)[i],
            "cloudcover": daily.get("cloudcover_mean", [0]*7)[i],
            "weather_code": daily.get("weather_code", [0]*7)[i],
        }
        
        # Generate daily note
        daily_note = generate_daily_note(day_data, species_list)
        
        # Analyze for each species - exceptions only
        species_exceptions = {}
        for sp in species_list:
            if sp in SPECIES_DB:
                analysis = analyze_conditions(
                    day_data["temp_max"],
                    day_data["temp_min"],
                    day_data["humidity"],
                    day_data["precipitation"],
                    sp
                )
                if analysis["exceptions"]:
                    species_exceptions[sp] = {
                        "common_name": SPECIES_DB[sp]["common_names"][0],
                        "exceptions": analysis["exceptions"],
                        "phase": analysis["phase"]
                    }
        
        day_data["daily_note"] = daily_note
        day_data["species_exceptions"] = species_exceptions
        
        # Risk flags for card coloring
        has_frost = any(
            "frost" in str(exc).lower()
            for sp_exc in species_exceptions.values()
            for exc in sp_exc.get("exceptions", [])
        )
        has_heat = any(
            "heat stress" in str(exc).lower()
            for sp_exc in species_exceptions.values()
            for exc in sp_exc.get("exceptions", [])
        )
        
        if has_frost:
            day_data["risk_level"] = "danger"
        elif has_heat or species_exceptions:
            day_data["risk_level"] = "caution"
        else:
            day_data["risk_level"] = "optimal"
        
        daily_advisories.append(day_data)
    
    return jsonify({
        "current": current,
        "daily_advisories": daily_advisories,
        "location": loc_data
    })


if __name__ == "__main__":
    # Production: debug=False, development: debug=True
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
