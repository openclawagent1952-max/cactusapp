/**
 * Cactus Weather Advisor - v1.0 Frontend
 * Fahrenheit only
 */

let selectedSpecies = ['pachanoi', 'peruvianus', 'bridgesii'];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSpecies('Tampa');
    setupEventListeners();
    fetchForecast();
});

// Weather code to icon/text (WMO Weather interpretation codes)
function getWeatherDesc(code) {
    const codes = {
        0: 'Clear',
        1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Fog', 48: 'Depositing Rime Fog',
        51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
        56: 'Light Freezing Drizzle', 57: 'Dense Freezing Drizzle',
        61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
        66: 'Light Freezing Rain', 67: 'Heavy Freezing Rain',
        71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Slight Rain Showers', 81: 'Moderate Rain Showers', 82: 'Violent Rain Showers',
        85: 'Slight Snow Showers', 86: 'Heavy Snow Showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Thunderstorm with Heavy Hail'
    };
    return codes[code] || 'Unknown';
}

function getWeatherIcon(code) {
    const icons = {
        0: '☀️',
        1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌦️', 53: '🌧️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌨️', 67: '🌨️',
        71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
        80: '🌦️', 81: '🌧️', 82: '⛈️',
        85: '🌨️', 86: '🌨️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '🌡️';
}

async function loadSpecies(location = 'Tampa') {
    try {
        const params = new URLSearchParams({ location: location });
        const resp = await fetch(`/api/species?${params}`);
        const data = await resp.json();
        renderSpecies(data.core_species, data.additional_species);
    } catch (e) {
        console.error('Failed to load species:', e);
    }
}

function renderSpecies(coreSpecies, additionalSpecies) {
    const grid = document.getElementById('species-grid');
    
    // Render core species (large cards, selected by default)
    let html = '<h3 style="margin: 16px 0 8px 0; color: var(--hunter-green);">Core Species</h3>';
    html += '<div class="core-species-grid">';
    html += coreSpecies.map(s => renderSpeciesCard(s, true)).join('');
    html += '</div>';
    
    // Render additional species (small cards, not selected)
    html += '<h3 style="margin: 24px 0 8px 0; color: var(--hunter-green);">Additional Species</h3>';
    html += '<div class="additional-species-grid">';
    html += additionalSpecies.map(s => renderSpeciesCard(s, false)).join('');
    html += '</div>';
    
    grid.innerHTML = html;
}

function renderSpeciesCard(s, isCore) {
    const key = s.key.replace('trichocereus_', '');
    const isSelected = selectedSpecies.includes(key);
    const p = s.preferred_params;
    
    const cardClass = isCore ? 'species-card' : 'species-card additional';
    
    return `
        <div class="${cardClass} ${isSelected ? 'selected' : ''}" data-key="${key}"
             onclick="toggleSpecies('${key}')">
            <div class="species-name">${s.name}</div>
            <div class="species-latin">T. ${key}</div>
            <div class="species-params">
                <div>☀️ ${p.temp_day_range[0]}${s.temp_symbol}-${p.temp_day_range[1]}${s.temp_symbol}</div>
                <div>❄️ ${p.frost_threshold}${s.temp_symbol}</div>
                <div>🔥 ${p.heat_stress}${s.temp_symbol}</div>
                <div>💧 Humidity: ${p.humidity_range[0]}%-${p.humidity_range[1]}%</div>
            </div>
        </div>
    `;
}

function toggleSpecies(key) {
    if (selectedSpecies.includes(key)) {
        selectedSpecies = selectedSpecies.filter(k => k !== key);
    } else {
        selectedSpecies.push(key);
    }
    
    document.querySelectorAll('.species-card').forEach(card => {
        card.classList.toggle('selected', 
            selectedSpecies.includes(card.dataset.key));
    });
    
    fetchForecast();
}

function setupEventListeners() {
    document.getElementById('search-btn').addEventListener('click', fetchForecast);
    document.getElementById('location-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchForecast();
    });
}

async function fetchForecast() {
    const location = document.getElementById('location-input').value;
    if (!location) return;
    
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    
    try {
        // Reload species with correct units for this location
        await loadSpecies(location);
        
        const params = new URLSearchParams({
            location: location,
            species: selectedSpecies.join(',')
        });
        const resp = await fetch(`/api/forecast?${params}`);
        const data = await resp.json();
        
        if (data.error) throw new Error(data.error);
        
        renderCurrent(data.current);
        renderForecast(data.daily_advisories);
        
        document.getElementById('results').style.display = 'block';
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function renderCurrent(current) {
    const weatherDesc = getWeatherDesc(current.weather_code);
    const icon = getWeatherIcon(current.weather_code);
    
    document.getElementById('current').innerHTML = `
        <div class="current-card">
            <div class="stat">
                <div class="stat-icon">📍</div>
                <div class="stat-value">${current.location.city}, ${current.location.region}</div>
                <div class="stat-label">Location</div>
            </div>
            <div class="stat">
                <div class="stat-icon">${icon}</div>
                <div class="stat-value">${Math.round(current.temp)}°</div>
                <div class="stat-label">${weatherDesc}</div>
            </div>
            <div class="stat">
                <div class="stat-icon">💧</div>
                <div class="stat-value">${current.humidity}%</div>
                <div class="stat-label">Humidity</div>
            </div>
            <div class="stat">
                <div class="stat-icon">🌬️</div>
                <div class="stat-value">${Math.round(current.wind)} ${current.speed_symbol || 'mph'}</div>
                <div class="stat-label">Wind</div>
            </div>
            <div class="stat">
                <div class="stat-icon">☁️</div>
                <div class="stat-value">${current.cloudcover}%</div>
                <div class="stat-label">Cloud Cover</div>
            </div>
            <div class="stat">
                <div class="stat-icon">🌡️</div>
                <div class="stat-value">${Math.round(current.pressure || 1013)}</div>
                <div class="stat-label">Pressure (hPa)</div>
            </div>
        </div>
    `;
}

function renderForecast(advisories) {
    document.getElementById('forecast').innerHTML = advisories.slice(0, 7).map((a) => {
        const weatherDesc = getWeatherDesc(a.weather_code);
        const icon = getWeatherIcon(a.weather_code);
        const precip = (a.precipitation || 0).toFixed(2);

        // Handle temp field names
        const highTemp = a.temp_max !== undefined ? a.temp_max : (a.temp_max_f || 0);
        const lowTemp = a.temp_min !== undefined ? a.temp_min : (a.temp_min_f || 0);

        // Build exceptions list
        let exceptionsHTML = '';
        const exceptions = a.species_exceptions || {};

        if (Object.keys(exceptions).length === 0) {
            exceptionsHTML = '<div class="no-exceptions">✓ All species within normal ranges</div>';
        } else {
            exceptionsHTML = Object.entries(exceptions).map(([spKey, data]) => {
                const exceptionItems = data.exceptions.map(exc => {
                    let excClass = 'exception-item';
                    if (exc.includes('❄️')) excClass += ' frost';
                    else if (exc.includes('🧊')) excClass += ' cold';
                    else if (exc.includes('🔥')) excClass += ' heat';
                    else if (exc.includes('🦠')) excClass += ' rot';
                    else if (exc.includes('💧')) excClass += ' humidity';
                    else if (exc.includes('📊')) excClass += ' volatility';
                    else if (exc.includes('🌡️')) excClass += ' soil';
                    else if (exc.includes('🌙')) excClass += ' humidity';

                    return '<div class="' + excClass + '">' +
                        '<span class="exception-icon">' + exc.split(' ')[0] + '</span>' +
                        '<span class="exception-text">' +
                            '<span class="exception-species">' + data.common_name + '</span>' +
                            exc.substring(exc.indexOf(' ') + 1) +
                        '</span>' +
                    '</div>';
                }).join('');
                return exceptionItems;
            }).join('');
        }

        const riskClass = a.risk_level || 'optimal';

        return '<div class="forecast-card ' + riskClass + '">' +
            '<div class="forecast-header">' +
                '<div class="day-section">' +
                    '<div class="day">' + a.day_of_week + '</div>' +
                    '<div class="date">' + a.date + '</div>' +
                    '<div class="weather-main">' + icon + ' ' + weatherDesc + '</div>' +
                '</div>' +
                '<div class="level-badge ' + riskClass + '">' + riskClass + '</div>' +
            '</div>' +

            '<div class="weather-grid">' +
                '<div class="weather-item">' +
                    '<div class="weather-label">High</div>' +
                    '<div class="weather-value">' + Math.round(highTemp) + '°</div>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<div class="weather-label">Low</div>' +
                    '<div class="weather-value">' + Math.round(lowTemp) + '°</div>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<div class="weather-label">Swing</div>' +
                    '<div class="weather-value">' + Math.round(a.temp_swing || (highTemp - lowTemp)) + '°</div>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<div class="weather-label">Humidity</div>' +
                    '<div class="weather-value">' + Math.round(a.humidity) + '%</div>' +
                '</div>' +
                '<div class="weather-item">' +
                    '<div class="weather-label">Precip</div>' +
                    '<div class="weather-value">' + precip + '"</div>' +
                '</div>' +
            '</div>' +

            '<div class="species-advice-container">' +
                '<div class="daily-note">' + a.daily_note + '</div>' +
                '<div class="exceptions-section">' + exceptionsHTML + '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}
