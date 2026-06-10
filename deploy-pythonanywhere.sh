"""
Cactus Weather Advisor - Phase 1 MVP
Auto-detects Metric vs Imperial based on location.

Notes:
- Species thresholds are practical cultivation estimates, not hard botanical constants.
- Frost thresholds assume brief exposure, dry soil, mature plants, and dormancy.
- Container-grown plants are less tolerant of cold/wet stress than established in-ground plants.
"""

from flask import Flask, render_template, jsonify, request
import requests
import os
from datetime import datetime

app = Flask(__name__)

# Countries that commonly use Fahrenheit in public weather reporting
FAHRENHEIT_COUNTRIES = {
    "United States",
    "Liberia",
    "Myanmar",
    "Bahamas",
    "Belize",
    "Cayman Islands",
}

# Practical cultivation database - stored internally in Celsius
SPECIES_DB = {
    "pachanoi": {
        "common_names": ["San Pedro"],
        "notes": "Most forgiving, humidity-tolerant. True pachanoi hardier than the common PC/pachanot clone.",
        "origin": "Ecuador/Peru Andes, roughly 6000-9000 ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 38},
        "humidity_optimal": {"min": 30, "max": 80},
        "is_core": True,
    },
    "peruvianus": {
        "common_names": ["Peruvian Torch"],
        "notes": "More rot-prone than pachanoi. Needs excellent drainage and airflow.",
        "origin": "Peru highlands, roughly 8000-10000 ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 40},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": True,
    },
    "bridgesii": {
        "common_names": ["Bolivian Torch"],
        "notes": "Fast grower when warm. Cold-tolerant when dry, but rot-prone in humid/wet conditions.",
        "origin": "Bolivia highlands, roughly 9000-11000 ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 29},
        "temp_critical_c": {"frost_threshold": -5, "heat_stress": 35},
        "humidity_optimal": {"min": 30, "max": 70},
        "is_core": True,
    },
    "scopulicola": {
        "common_names": ["Scopulicola"],
        "notes": "Rare, mostly spineless columnar type. Similar care to bridgesii/pachanoi, but avoid wet cool conditions.",
        "origin": "Bolivia, roughly 5000-8000 ft",
        "temp_optimal_c": {"day_min": 20, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -3, "heat_stress": 37},
        "humidity_optimal": {"min": 35, "max": 70},
        "is_core": False,
    },
    "terscheckii": {
        "common_names": ["Argentine Saguaro"],
        "notes": "Very cold-hardy when established and dry. Tree-like, massive, and slow-growing.",
        "origin": "Argentina, roughly 5000-9500 ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 30},
        "temp_critical_c": {"frost_threshold": -9, "heat_stress": 42},
        "humidity_optimal": {"min": 20, "max": 50},
        "is_core": False,
    },
    "macrogonus": {
        "common_names": ["Macrogonus"],
        "notes": "Blue-green, long-spined type. Similar general care to peruvianus.",
        "origin": "Peru/Bolivia, roughly 8000-10000 ft",
        "temp_optimal_c": {"day_min": 19, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 39},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": False,
    },
    "validus": {
        "common_names": ["Validus"],
        "notes": "Cold-tolerant, heavy-spined, slower-growing type. Keep dry in cold weather.",
        "origin": "Argentina/Bolivia region, roughly 6000-9000 ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 28},
        "temp_critical_c": {"frost_threshold": -8, "heat_stress": 40},
        "humidity_optimal": {"min": 25, "max": 55},
        "is_core": False,
    },
    "werdermannianus": {
        "common_names": ["Werdermannianus"],
        "notes": "Tree-like, multi-stemmed type. Intermediate hardiness. Avoid cold/wet exposure.",
        "origin": "Bolivia, roughly 8000-11000 ft",
        "temp_optimal_c": {"day_min": 17, "day_max": 27},
        "temp_critical_c": {"frost_threshold": -5, "heat_stress": 36},
        "humidity_optimal": {"min": 30, "max": 60},
        "is_core": False,
    },
    "taquimbalensis": {
        "common_names": ["Taquimbalensis"],
        "notes": "Bolivian species from dry inter-Andean valleys. Prefers strong light, mineral drainage, and airflow.",
        "origin": "Bolivia, inter-Andean dry valleys",
        "temp_optimal_c": {"day_min": 20, "day_max": 32},
        "temp_critical_c": {"frost_threshold": -2, "heat_stress": 40},
        "humidity_optimal": {"min": 25, "max": 60},
        "is_core": False,
    },
    "cuzcoensis": {
        "common_names": ["Cuzcoensis"],
        "notes": "High-altitude Peruvian type. Cold-tolerant when dry, but dislikes prolonged wet/cool conditions.",
        "origin": "Peru, roughly 10000-13000 ft",
        "temp_optimal_c": {"day_min": 16, "day_max": 26},
        "temp_critical_c": {"frost_threshold": -6, "heat_stress": 33},
        "humidity_optimal": {"min": 30, "max": 65},
        "is_core": False,
    },
    "spachianus": {
        "common_names": ["Golden Torch"],
        "notes": "Hardy, adaptable Argentine species. Often more forgiving than many blue Trichocereus types.",
        "origin": "Argentina, roughly 3000-5000 ft",
        "temp_optimal_c": {"day_min": 18, "day_max": 32},
        "temp_critical_c": {"frost_threshold": -4, "heat_stress": 40},
        "humidity_optimal": {"min": 30, "max": 65},
        "is_core": False,
    },
}


def c_to_f(c):
    return round((c * 9 / 5) + 32)


def f_to_c(f):
    return round((f - 32) * 5 / 9)


def normalize_species_key(species_key):
    """
    Allows frontend keys like:
    - pachanoi
    - trichocereus_pachanoi
    """
    return species_key.strip().lower().replace("trichocereus_", "")


def get_unit_config(country):
    """Return unit config based on country."""
    if country in FAHRENHEIT_COUNTRIES:
        return {
            "temp_unit": "fahrenheit",
            "speed_unit": "mph",
            "precip_unit": "inch",
            "use_fahrenheit": True,
            "temp_symbol": "°F",
            "speed_symbol": "mph",
            "precip_symbol": '"',
        }

    return {
        "temp_unit": "celsius",
        "speed_unit": "kmh",
        "precip_unit": "mm",
        "use_fahrenheit": False,
        "temp_symbol": "°C",
        "speed_symbol": "km/h",
        "precip_symbol": "mm",
    }


def get_species_data(species_key, use_fahrenheit):
    """Get species with correct temperature units."""
    species_key = normalize_species_key(species_key)
    base = SPECIES_DB[species_key]
    sp = base.copy()

    if use_fahrenheit:
        sp["temp_optimal"] = {
            "day_min": c_to_f(base["temp_optimal_c"]["day_min"]),
            "day_max": c_to_f(base["temp_optimal_c"]["day_max"]),
        }
        sp["temp_critical"] = {
            "frost_threshold": c_to_f(base["temp_critical_c"]["frost_threshold"]),
            "heat_stress": c_to_f(base["temp_critical_c"]["heat_stress"]),
        }
    else:
        sp["temp_optimal"] = base["temp_optimal_c"]
        sp["temp_critical"] = base["temp_critical_c"]

    return sp


def geocode_location(location_str):
    """Geocode with country detection for unit selection."""
    try:
        original = location_str.strip()
        if not original:
            original = "Tampa"

        alt_spellings = {
            "bruxelles": "brussels",
            "bruxelles, belgium": "brussels, belgium",
            "copenhagen": "københavn",
            "rome": "roma",
            "florence": "firenze",
            "naples": "napoli",
            "turin": "torino",
            "milan": "milano",
            "venice": "venezia",
            "genoa": "genova",
            "padua": "padova",
            "vienna": "wien",
            "prague": "praha",
            "krakow": "kraków",
            "bratislava": "pressburg",
            "ljubljana": "laibach",
            "trieste": "trst",
            "ghent": "gent",
            "antwerp": "antwerpen",
            "bruges": "brugge",
            "cologne": "köln",
            "munich": "münchen",
            "nuremberg": "nürnberg",
            "basle": "basel",
            "zurich": "zürich",
            "geneva": "genève",
        }

        original_lower = original.lower()
        if original_lower in alt_spellings:
            original = alt_spellings[original_lower]
            original_lower = original.lower()

        normalized = original

        us_state_codes = {
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
            "DC",
        }

        # Convert "Holiday FL" into "Holiday, FL"
        words = original.split()
        if len(words) >= 2:
            last_word = words[-1].upper()
            if len(last_word) == 2 and last_word in us_state_codes:
                city_name = " ".join(words[:-1])
                normalized = f"{city_name}, {last_word}"

        search_terms = [
            normalized,
            original,
            original.title(),
            original_lower,
        ]

        if "," in original:
            city_only = original.split(",")[0].strip()
            search_terms.extend([city_only, city_only.title(), city_only.lower()])

        # Remove duplicates while preserving order
        unique_terms = []
        seen = set()
        for term in search_terms:
            key = term.lower().replace(" ", "")
            if key not in seen and len(term) > 1:
                seen.add(key)
                unique_terms.append(term)

        for search_term in unique_terms:
            url = "https://geocoding-api.open-meteo.com/v1/search"
            resp = requests.get(
                url,
                params={
                    "name": search_term,
                    "count": 10,
                    "language": "en",
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            if "results" not in data or not data["results"]:
                continue

            for result in data["results"]:
                feature_code = result.get("feature_code", "")
                country = result.get("country", "")

                # Skip countries/regions/continents. Prefer populated places.
                if feature_code in {"PCLI", "PCLD", "PCLF", "TERR", "CONT"}:
                    continue

                if not feature_code.startswith("PPL") and feature_code not in {
                    "ADM2",
                    "ADM3",
                    "ADM4",
                }:
                    continue

                admin1 = result.get("admin1", "")
                result_name = result.get("name", search_term)

                if country == "United States" and admin1:
                    display_name = f"{result_name}, {admin1}"
                else:
                    display_name = f"{result_name}, {country}"

                return {
                    "lat": result["latitude"],
                    "lon": result["longitude"],
                    "name": display_name,
                    "country": country,
                    "use_fahrenheit": country in FAHRENHEIT_COUNTRIES,
                }

        return None

    except Exception as e:
        print(f"Geocode error: {e}")
        return None


def format_date(date_str, country):
    """USA gets MM/DD/YYYY. Most other countries get DD/MM/YYYY."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    if country == "United States":
        return dt.strftime("%m/%d/%Y")
    return dt.strftime("%d/%m/%Y")


def get_weather(lat, lon, use_fahrenheit):
    """Get weather with correct units."""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        units = get_unit_config("United States" if use_fahrenheit else "Other")

        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": ",".join([
                "temperature_2m_max",
                "temperature_2m_min",
                "relative_humidity_2m_mean",
                "precipitation_sum",
                "weather_code",
                "cloud_cover_mean",
                "wind_speed_10m_max",
            ]),
            "current": ",".join([
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
                "cloud_cover",
                "weather_code",
            ]),
            "forecast_days": 7,
            "temperature_unit": units["temp_unit"],
            "wind_speed_unit": units["speed_unit"],
            "precipitation_unit": units["precip_unit"],
        }

        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()

    except Exception as e:
        print(f"Weather error: {e}")
        return None


def get_precip_thresholds(use_fahrenheit):
    """Return light/heavy precipitation thresholds in selected units."""
    if use_fahrenheit:
        return {
            "light": 0.01,
            "meaningful": 0.10,
            "heavy": 0.25,
        }

    return {
        "light": 0.2,
        "meaningful": 2.5,
        "heavy": 6.0,
    }


def calculate_rot_risk(day_max, day_min, humidity, precip, hum_max, use_fahrenheit):
    """
    Rot risk should not be based on humidity alone.
    More useful risk comes from humidity + rain/wet soil + cool weather.
    """
    thresholds = get_precip_thresholds(use_fahrenheit)
    risk_score = 0
    reasons = []

    cool_night = 60 if use_fahrenheit else 16
    cool_day = 75 if use_fahrenheit else 24

    if humidity > hum_max + 10:
        risk_score += 1
        reasons.append(f"humid air at {humidity}%")

    if precip >= thresholds["meaningful"]:
        risk_score += 2
        reasons.append(f"meaningful rain at {precip}")

    elif precip >= thresholds["light"]:
        risk_score += 1
        reasons.append(f"light rain at {precip}")

    if day_min < cool_night:
        risk_score += 1
        reasons.append("cool night")

    if day_max < cool_day:
        risk_score += 1
        reasons.append("cool day")

    return risk_score, reasons


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/species")
def get_species():
    """Return species with units based on location."""
    location = request.args.get("location", "Tampa")

    loc_data = geocode_location(location)
    use_fahrenheit = loc_data["use_fahrenheit"] if loc_data else True

    core_species = []
    additional_species = []

    for key, data in SPECIES_DB.items():
        sp = get_species_data(key, use_fahrenheit)

        species_data = {
            "key": key,
            "frontend_key": f"trichocereus_{key}",
            "name": data["common_names"][0],
            "notes": data["notes"],
            "origin": data["origin"],
            "preferred_params": {
                "temp_day_range": [
                    sp["temp_optimal"]["day_min"],
                    sp["temp_optimal"]["day_max"],
                ],
                "frost_threshold": sp["temp_critical"]["frost_threshold"],
                "heat_stress": sp["temp_critical"]["heat_stress"],
                "humidity_range": [
                    data["humidity_optimal"]["min"],
                    data["humidity_optimal"]["max"],
                ],
            },
            "temp_symbol": "°F" if use_fahrenheit else "°C",
            "is_core": data.get("is_core", False),
        }

        if data.get("is_core", False):
            core_species.append(species_data)
        else:
            additional_species.append(species_data)

    return jsonify({
        "core_species": core_species,
        "additional_species": additional_species,
        "use_fahrenheit": use_fahrenheit,
    })


@app.route("/api/forecast")
def get_forecast():
    location = request.args.get("location", "Tampa")

    requested_species = request.args.get("species", "pachanoi").split(",")
    species_list = [
        normalize_species_key(sp)
        for sp in requested_species
        if normalize_species_key(sp) in SPECIES_DB
    ]

    if not species_list:
        species_list = ["pachanoi"]

    loc_data = geocode_location(location)
    if not loc_data:
        return jsonify({"error": "Location not found"}), 404

    use_fahrenheit = loc_data["use_fahrenheit"]
    units = get_unit_config("United States" if use_fahrenheit else "Other")

    weather = get_weather(loc_data["lat"], loc_data["lon"], use_fahrenheit)
    if not weather:
        return jsonify({"error": "Weather unavailable"}), 503

    current_data = weather.get("current", {})

    current = {
        "temp": current_data.get("temperature_2m"),
        "humidity": current_data.get("relative_humidity_2m"),
        "wind": current_data.get("wind_speed_10m"),
        "cloudcover": current_data.get("cloud_cover", 0),
        "weather_code": current_data.get("weather_code", 0),
        "location": {
            "city": loc_data["name"],
            "region": loc_data["country"],
        },
        "temp_symbol": units["temp_symbol"],
        "speed_symbol": units["speed_symbol"],
    }

    daily_advisories = []
    daily = weather.get("daily", {})
    dates = daily.get("time", [])

    precip_thresholds = get_precip_thresholds(use_fahrenheit)

    for i in range(len(dates)):
        day_max = daily["temperature_2m_max"][i]
        day_min = daily["temperature_2m_min"][i]
        humidity = daily["relative_humidity_2m_mean"][i]
        precip = daily.get("precipitation_sum", [0] * len(dates))[i]
        wind = daily.get("wind_speed_10m_max", [0] * len(dates))[i]
        cloudcover = daily.get("cloud_cover_mean", [0] * len(dates))[i]
        weather_code = daily.get("weather_code", [0] * len(dates))[i]

        day_data = {
            "date": format_date(dates[i], loc_data["country"]),
            "iso_date": dates[i],
            "day_of_week": datetime.strptime(dates[i], "%Y-%m-%d").strftime("%A"),
            "temp_max": day_max,
            "temp_min": day_min,
            "humidity": humidity,
            "precipitation": precip,
            "wind": wind,
            "cloudcover": cloudcover,
            "weather_code": weather_code,
            "temp_symbol": units["temp_symbol"],
            "speed_symbol": units["speed_symbol"],
            "precip_symbol": units["precip_symbol"],
        }

        species_exceptions = {}

        for sp_key in species_list:
            sp_data = get_species_data(sp_key, use_fahrenheit)

            exceptions = []
            frost_thresh = sp_data["temp_critical"]["frost_threshold"]
            heat_thresh = sp_data["temp_critical"]["heat_stress"]
            hum_max = sp_data["humidity_optimal"]["max"]

            # Frost warning buffer
            frost_buffer = 3 if use_fahrenheit else 2

            if day_min < frost_thresh:
                exceptions.append(
                    f"❄️ CRITICAL: {day_min}{units['temp_symbol']} is below frost threshold "
                    f"({frost_thresh}{units['temp_symbol']}). Keep dry and protect."
                )
            elif day_min < frost_thresh + frost_buffer:
                exceptions.append(
                    f"❄️ Frost warning: {day_min}{units['temp_symbol']} is approaching "
                    f"{frost_thresh}{units['temp_symbol']}. Protect sensitive plants."
                )

            # Heat warning
            if day_max > heat_thresh:
                exceptions.append(
                    f"🔥 Heat stress: {day_max}{units['temp_symbol']} exceeds "
                    f"{heat_thresh}{units['temp_symbol']}. Provide shade/airflow if needed."
                )

            # Rot-risk warning: humidity + rain/coolness, not humidity alone
            rot_score, rot_reasons = calculate_rot_risk(
                day_max=day_max,
                day_min=day_min,
                humidity=humidity,
                precip=precip,
                hum_max=hum_max,
                use_fahrenheit=use_fahrenheit,
            )

            if rot_score >= 3:
                exceptions.append(
                    "💧 Rot risk: humid/wet/cool pattern. Keep soil dry, maximize airflow, "
                    "and avoid watering."
                )
            elif humidity > hum_max + 10:
                exceptions.append(
                    f"💧 Humid air ({humidity}%): watch airflow and avoid wet soil."
                )

            if exceptions:
                species_exceptions[sp_key] = {
                    "common_name": sp_data["common_names"][0],
                    "exceptions": exceptions,
                }

        has_critical = any(
            "CRITICAL" in exception
            for sp in species_exceptions.values()
            for exception in sp["exceptions"]
        )

        has_warning = bool(species_exceptions)

        if has_critical:
            risk_level = "danger"
        elif has_warning:
            risk_level = "caution"
        else:
            risk_level = "optimal"

        day_data["species_exceptions"] = species_exceptions
        day_data["risk_level"] = risk_level

        note_parts = []

        if day_max > (95 if use_fahrenheit else 35):
            note_parts.append(f"Very hot day ahead ({day_max}{units['temp_symbol']}).")
        elif day_max > (90 if use_fahrenheit else 32):
            note_parts.append(f"Hot day ahead ({day_max}{units['temp_symbol']}).")
        elif day_max > (80 if use_fahrenheit else 27):
            note_parts.append(f"Warm day ({day_max}{units['temp_symbol']}).")
        else:
            note_parts.append(f"Mild day ({day_max}{units['temp_symbol']}).")

        if precip >= precip_thresholds["heavy"]:
            note_parts.append(
                f"Heavy rain expected ({precip}{units['precip_symbol']}). Do not water."
            )
        elif precip >= precip_thresholds["meaningful"]:
            note_parts.append(
                f"Rain expected ({precip}{units['precip_symbol']}). Skip watering."
            )
        elif precip > 0:
            note_parts.append(
                f"Light rain possible ({precip}{units['precip_symbol']}). Check soil before watering."
            )
        else:
            note_parts.append("No rain forecast. Water only if soil is fully dry.")

        if humidity > 80:
            note_parts.append("High ambient humidity: prioritize airflow.")

        day_data["daily_note"] = " ".join(note_parts)
        daily_advisories.append(day_data)

    return jsonify({
        "current": current,
        "daily_advisories": daily_advisories,
        "location": loc_data,
        "units": units,
        "species_checked": species_list,
    })


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=debug, host="0.0.0.0", port=port)