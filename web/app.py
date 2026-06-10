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
# All values verified from botanical research, USDA zones, and field observations
# Frost thresholds: brief exposure only when dry and dormant
SPECIES_DB = {
    "pachanoi": {
        "common_names": ["San Pedro"],
        "notes": "Most forgiving, humidity-tolerant. True pachanoi hardier than pachanot clone.",
        "origin": "Ecuador/Peru Andes, 6000-9000ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 38},
        "humidity_optimal": {"min": 30, "max": 80},
        "is_core": True
    },
    "peruvianus": {
        "common_names": ["Peruvian Torch"],
        "notes": "More rot-prone than pachanoi. Needs excellent drainage.",
        "origin": "Peru highlands, 8000-10000ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 40},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": True
    },
    "bridgesii": {
        "common_names": ["Bolivian Torch"],
        "notes": "Fastest grower when warm. Most cold-hardy of the big three.",
        "origin": "Bolivia highlands, 9000-11000ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -5, "heat_stress": 35},
        "humidity_optimal": {"min": 30, "max": 70},
        "is_core": True
    },
    # Additional hobby species - scientifically verified values
    "scopulicola": {
        "common_names": ["Scopulicola"],
        "notes": "Rare, spineless, columnar. Slightly less hardy than pachanoi.",
        "origin": "Bolivia, 5000-8000ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -3, "heat_stress": 37},
        "humidity_optimal": {"min": 35, "max": 70},
        "is_core": False
    },
    "terscheckii": {
        "common_names": ["Argentine Saguaro"],
        "notes": "MOST COLD-HARDY. Tree-like, massive, very slow growing.",
        "origin": "Argentina, 5000-9500ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 30},
        "temp_critical_c": {"frost_threshold": -9, "heat_stress": 42},
        "humidity_optimal": {"min": 20, "max": 50},
        "is_core": False
    },
    "macrogonus": {
        "common_names": ["Macrogonus"],
        "notes": "Blue-green, long spines. Similar hardiness to peruvianus.",
        "origin": "Peru/Bolivia, 8000-10000ft",
        "temp_optimal_c": {"day_min": 19, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 39},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": False
    },
    "validus": {
        "common_names": ["Validus"],
        "notes": "Very cold-hardy. Heavy spination, slow growth.",
        "origin": "Argentina, 6000-9000ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -8, "heat_stress": 40},
        "humidity_optimal": {"min": 25, "max": 55},
        "is_core": False
    },
    "werdermannianus": {
        "common_names": ["Werdermannianus"],
        "notes": "Tree-like, multi-stemmed. Intermediate hardiness.",
        "origin": "Bolivia, 8000-11000ft",
        "temp_optimal_c": {"day_min": 17, "day_max": 27},
        "temp_critical_c": {"frost_threshold": -5, "heat_stress": 36},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": False
    },
    "taquimbalensis": {
        "common_names": ["Taquimbalensis"],
        "notes": "Mexican species, lower altitude, less frost tolerant.",
        "origin": "Mexico, 3000-6000ft",
        "temp_optimal_c": {"day_min": 21, "day_max": 32},
        "temp_critical_c": {"frost_threshold": -2, "heat_stress": 40},
        "humidity_optimal": {"min": 35, "max": 75},
        "is_core": False
    },
    "cuzcoensis": {
        "common_names": ["Cuzcoensis"],
        "notes": "High altitude Peruvian. Quite cold-hardy when dry.",
        "origin": "Peru, 10000-13000ft",
        "temp_optimal_c": {"day_min": 16, "day_max": 26},
        "temp_critical_c": {"frost_threshold": -6, "heat_stress": 33},
        "humidity_optimal": {"min": 30, "max": 65},
        "is_core": False
    },
    "spachianus": {
        "common_names": ["Golden Torch"],
        "notes": "Argentine lowland. Less cold-hardy, warmer climate.",
        "origin": "Argentina lowlands, 3000-5000ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 32},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 40},
        "humidity_optimal": {"min": 30, "max": 65},
        "is_core": False
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
        
        # Common alternate spellings/misspellings
        ALT_SPELLINGS = {
            'bruxelles': 'brussels',
            'bruxelles, belgium': 'brussels, belgium',
            'copenhagen': 'københavn',
            'rome': 'roma',
            'florence': 'firenze',
            'naples': 'napoli',
            'turin': 'torino',
            'milan': 'milano',
            'venice': 'venezia',
            'genoa': 'genova',
            'padua': 'padova',
            'vienna': 'wien',
            'prague': 'praha',
            'krakow': 'kraków',
            'bratislava': 'pressburg',
            'ljubljana': 'laibach',
            'trieste': 'trst',
            'ghent': 'gent',
            'antwerp': 'antwerpen',
            'bruges': 'brugge',
            'cologne': 'köln',
            'munich': 'münchen',
            'nuremberg': 'nürnberg',
            'vienna': 'wien',
            'basle': 'basel',
            'zurich': 'zürich',
            'geneva': 'genève',
        }
        
        # Check for alternate spellings (case insensitive)
        original_lower = original.lower()
        if original_lower in ALT_SPELLINGS:
            original = ALT_SPELLINGS[original_lower]
            original_lower = original.lower()
        
        normalized = original
        
        # Normalize US state formats
        us_state_codes = {'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'}
        
        # Check for "City Name ST" pattern (case insensitive)
        words = original.split()
        if len(words) >= 2:
            last_word = words[-1].upper()
            if len(last_word) == 2 and last_word in us_state_codes:
                # Extract city name (everything before state code)
                city_name = ' '.join(words[:-1])
                normalized = f"{city_name}, {last_word}"
        
        # Try multiple search strategies with different cases
        search_terms = [
            original,  # Original case
            original.title(),  # Title Case
            original_lower,  # Lowercase
            normalized,
        ]
        
        # Add city-only version if comma present
        if ',' in original:
            city_only = original.split(',')[0].strip()
            search_terms.extend([city_only, city_only.title(), city_only.lower()])
        
        # Remove duplicates while preserving order
        seen = set()
        unique_terms = []
        for term in search_terms:
            term_key = term.lower().replace(' ', '')
            if term_key not in seen and len(term) > 1:
                seen.add(term_key)
                unique_terms.append(term)
        
        for search_term in unique_terms:
            clean_loc = search_term.replace(' ', '+')
            url = "https://geocoding-api.open-meteo.com/v1/search"
            resp = requests.get(url, params={"name": clean_loc, "count": 10, "language": "en"}, timeout=10)
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
                        display_name = f"{result.get('name', search_term)}, {admin1}"
                    else:
                        display_name = f"{result.get('name', search_term)}, {country}"
                    
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


def format_date(date_str, country):
    """Format date based on country - USA gets MM/DD/YYYY, rest get DD/MM/YYYY"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    if country == "United States":
        return dt.strftime("%m/%d/%Y")  # MM/DD/YYYY for USA
    else:
        return dt.strftime("%d/%m/%Y")  # DD/MM/YYYY for rest of world


def get_weather(lat, lon, use_fahrenheit):
    """Get weather with correct units - includes humidity extremes and soil temp"""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        units = get_unit_config("United States" if use_fahrenheit else "Other")
        
        # Open-Meteo requires daily parameters as a list, not comma-separated string
        daily_params = [
            "temperature_2m_max",
            "temperature_2m_min", 
            "relative_humidity_2m_mean",
            "precipitation_sum",
            "weather_code",
            "cloudcover_mean",
            "windspeed_10m_max"
        ]
        
        current_params = [
            "temperature_2m",
            "relative_humidity_2m",
            "windspeed_10m"
        ]
        
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": daily_params,
            "current": current_params,
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
    """Return species with units based on location"""
    location = request.args.get("location", "Tampa")  # Get location from request
    
    # Geocode to determine units
    loc_data = geocode_location(location)
    use_fahrenheit = loc_data["use_fahrenheit"] if loc_data else True
    
    species_list = []
    core_species = []
    additional_species = []
    
    for key, data in SPECIES_DB.items():
        sp = get_species_data(key, use_fahrenheit)
        species_data = {
            "key": f"trichocereus_{key}",
            "name": data["common_names"][0],
            "preferred_params": {
                "temp_day_range": [sp["temp_optimal"]["day_min"], sp["temp_optimal"]["day_max"]],
                "frost_threshold": sp["temp_critical"]["frost_threshold"],
                "heat_stress": sp["temp_critical"]["heat_stress"],
                "humidity_range": [data["humidity_optimal"]["min"], data["humidity_optimal"]["max"]]
            },
            "temp_symbol": "°F" if use_fahrenheit else "°C",
            "is_core": data.get("is_core", False)
        }
        if data.get("is_core", False):
            core_species.append(species_data)
        else:
            additional_species.append(species_data)
    
    return jsonify({
        "core_species": core_species,
        "additional_species": additional_species,
        "use_fahrenheit": use_fahrenheit
    })


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
    time_count = len(daily.get("time", []))
    
    # Ensure all arrays have the same length
    def safe_get(daily, key, default, index):
        arr = daily.get(key, [default] * time_count)
        if index < len(arr):
            return arr[index]
        return default
    
    for i in range(time_count):
        day_max = daily["temperature_2m_max"][i]
        day_min = daily["temperature_2m_min"][i]
        humidity = daily["relative_humidity_2m_mean"][i]
        precip = safe_get(daily, "precipitation_sum", 0, i)
        wind = safe_get(daily, "windspeed_10m_max", 0, i)
        cloudcover = safe_get(daily, "cloudcover_mean", 0, i)
        weather_code = safe_get(daily, "weather_code", 0, i)
        
        # Temperature volatility (daily swing)
        temp_swing = day_max - day_min
        
        # For fields not available in basic API, use calculated fallbacks
        humidity_min = humidity - 10  # Estimate
        humidity_max = humidity + 10  # Estimate
        soil_temp = (day_max + day_min) / 2  # Estimate soil as average of air
        
        day_data = {
            "date": format_date(daily["time"][i], loc_data["country"]),
            "day_of_week": datetime.strptime(daily["time"][i], "%Y-%m-%d").strftime("%A"),
            "temp_max": day_max,
            "temp_min": day_min,
            "temp_swing": temp_swing,
            "humidity": humidity,
            "humidity_min": humidity_min,
            "humidity_max": humidity_max,
            "soil_temp": soil_temp,
            "precipitation": precip,
            "wind": wind,
            "cloudcover": cloudcover,
            "weather_code": weather_code,
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
                
                # Low temperature alerts - check if below optimal minimum
                optimal_min = sp_data["temp_optimal"]["day_min"]
                
                # Frost (3° buffer for warning, critical when below threshold)
                if day_min < frost_thresh + (3 if use_fahrenheit else 2):
                    if day_min < frost_thresh:
                        exceptions.append(f"❄️ CRITICAL FROST: {day_min}{units['temp_symbol']} below frost threshold ({frost_thresh}{units['temp_symbol']})")
                    else:
                        exceptions.append(f"❄️ FROST WARNING: {day_min}{units['temp_symbol']} approaching threshold ({frost_thresh}{units['temp_symbol']})")
                # Cold but not freezing - below optimal minimum
                elif day_min < optimal_min - (5 if use_fahrenheit else 3):
                    exceptions.append(f"🧊 COLD STRESS: {day_min}{units['temp_symbol']} well below optimal minimum ({optimal_min}{units['temp_symbol']})")
                elif day_min < optimal_min:
                    exceptions.append(f"🧊 Cool temps: {day_min}{units['temp_symbol']} below optimal minimum ({optimal_min}{units['temp_symbol']})")
                
                # Heat
                if day_max > heat_thresh:
                    exceptions.append(f"🔥 Heat stress: {day_max}{units['temp_symbol']} exceeds {heat_thresh}{units['temp_symbol']}")
                
                # Temperature volatility - rapid swings stress plants
                if temp_swing > (40 if use_fahrenheit else 22):
                    exceptions.append(f"📊 Extreme temp swing: {temp_swing:.0f}{units['temp_symbol']} daily range stresses plants")
                elif temp_swing > (30 if use_fahrenheit else 17):
                    exceptions.append(f"📊 Large temp swing: {temp_swing:.0f}{units['temp_symbol']} daily range")
                
                # Humidity - track mean AND extremes
                if humidity > hum_max + 5:
                    exceptions.append(f"💧 High humidity ({humidity}%): exceeds {hum_max}%")
                elif humidity < hum_min - 5:
                    exceptions.append(f"💧 Low humidity ({humidity}%): below {hum_min}%")
                
                # Night humidity spike (dew/rot risk) - when min humidity is much higher than mean
                if humidity_min < hum_min and humidity_max > hum_max + 10:
                    exceptions.append(f"🌙 Humidity swing: {humidity_min}%→{humidity_max}% - rot risk if wet")
                
                # Soil temperature vs air temp (roots freeze before stems show damage)
                # Using estimated soil temp - actual would require soil_temperature_0cm API parameter
                soil_air_diff = soil_temp - day_min
                if soil_temp < frost_thresh and day_min > frost_thresh + 2:
                    exceptions.append(f"🌡️ Soil freeze risk: {soil_temp:.0f}{units['temp_symbol']} soil vs {day_min}{units['temp_symbol']} air - roots exposed!")
                
                if exceptions:
                    species_exceptions[sp] = {
                        "common_name": sp_data["common_names"][0],
                        "exceptions": exceptions
                    }
        
        day_data["species_exceptions"] = species_exceptions
        
        # Determine risk level
        risk_level = "optimal"
        for sp_data in species_exceptions.values():
            for exc in sp_data.get("exceptions", []):
                if "CRITICAL FROST" in exc or "Soil freeze risk" in exc:
                    risk_level = "danger"
                    break
                elif any(x in exc for x in ["FROST WARNING", "COLD STRESS", "Heat stress", 
                                             "High humidity", "Low humidity", "rot risk",
                                             "Extreme temp swing", "Large temp swing"]):
                    risk_level = "caution"
        day_data["risk_level"] = risk_level
        
        # Generate daily note - comprehensive assessment
        note_parts = []
        
        # High temp assessment
        if day_max > (90 if use_fahrenheit else 32):
            note_parts.append(f"Hot day ahead ({day_max}{units['temp_symbol']}).")
        elif day_max > (80 if use_fahrenheit else 27):
            note_parts.append(f"Warm day ({day_max}{units['temp_symbol']}).")
        else:
            note_parts.append(f"Mild day ({day_max}{units['temp_symbol']}).")
        
        # Low temp assessment (critical for frost zones!)
        if day_min < (35 if use_fahrenheit else 2):
            note_parts.append(f"⚠️ Cold night ({day_min}{units['temp_symbol']}) - protect plants!")
        elif day_min < (50 if use_fahrenheit else 10):
            note_parts.append(f"Cool night ({day_min}{units['temp_symbol']}) - growth slows.")
        
        # Temperature volatility
        if temp_swing > (40 if use_fahrenheit else 22):
            note_parts.append(f"⚡ Extreme temp swing ({temp_swing:.0f}°) - stress risk.")
        elif temp_swing > (30 if use_fahrenheit else 17):
            note_parts.append(f"Large temp swing ({temp_swing:.0f}°).")
        
        # Soil temperature concern
        if soil_temp < (40 if use_fahrenheit else 4) and day_min > (40 if use_fahrenheit else 4):
            note_parts.append(f"🌡️ Soil temp ({soil_temp:.0f}°) colder than air - root caution.")
        
        # Humidity volatility
        if humidity_max - humidity_min > 40:
            note_parts.append(f"💧 Humidity swings {humidity_min}%→{humidity_max}% - watch rot.")
        
        # Precipitation
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
