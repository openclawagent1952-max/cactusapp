/**
 * Cactus Weather Advisor - v1.0 Frontend
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

async function loadSpecies(location) {
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
    if (!grid) return;
    
    let html = '<h3 style="margin: 16px 0 8px 0; color: var(--hunter-green);">Core Species</h3>';
    html += '<div class="core-species-grid">';
    html += coreSpecies.map(s => renderSpeciesCard(s, true)).join('');
    html += '</div>';
    
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
    const searchBtn = document.getElementById('search-btn');
    const locationInput = document.getElementById('location-input');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', fetchForecast);
    }
    if (locationInput) {
        locationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchForecast();
        });
    }
}

async function fetchForecast() {
    const location = document.getElementById('location-input')?.value;
    if (!location) return;
    
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.getElementById('forecast-status');
    
    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.style.display = 'none';
    
    try {
        await loadSpecies(location);
        
        const params = new URLSearchParams({
            location: location,
            species: selectedSpecies.join(',')
        });
        
        const resp = await fetch(`/api/forecast?${params}`);
        const data = await resp.json();
        
        if (data.error) throw new Error(data.error);
        
        console.log('API Response - daily_advisories count:', data.daily_advisories?.length);
        
        renderCurrent(data.current);
        renderForecast(data.daily_advisories);
        
        if (resultsDiv) resultsDiv.style.display = 'block';
    } catch (e) {
        console.error('Fetch error:', e);
        if (statusDiv) statusDiv.textContent = 'Error: ' + e.message;
        alert('Error: ' + e.message);
    } finally {
        if (loadingDiv) loadingDiv.style.display = 'none';
    }
}

function renderCurrent(current) {
    const currentDiv = document.getElementById('current');
    if (!currentDiv) return;
    
    const weatherDesc = getWeatherDesc(current.weather_code);
    const icon = getWeatherIcon(current.weather_code);
    
    currentDiv.innerHTML = `
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
        </div>
    `;
}

function renderForecast(advisories) {
    const forecastDiv = document.getElementById('forecast');
    const statusDiv = document.getElementById('forecast-status');
    
    if (!forecastDiv) {
        console.error('forecast element not found');
        return;
    }
    
    console.log('renderForecast called with', advisories?.length, 'advisories');
    
    if (!advisories || !Array.isArray(advisories) || advisories.length === 0) {
        forecastDiv.innerHTML = '<div style="padding: 20px; color: red;">No forecast data available</div>';
        if (statusDiv) statusDiv.textContent = 'Error: No data';
        return;
    }
    
    try {
        let html = '';
        let exceptionCount = 0;
        
        advisories.slice(0, 7).forEach((day, index) => {
            console.log(`Processing day ${index + 1}:`, day.day_of_week, 
                        'exceptions:', Object.keys(day.species_exceptions || {}).length);
            
            const weatherDesc = getWeatherDesc(day.weather_code);
            const icon = getWeatherIcon(day.weather_code);
            const precip = (day.precipitation || 0).toFixed(2);
            const highTemp = day.temp_max !== undefined ? day.temp_max : 0;
            const lowTemp = day.temp_min !== undefined ? day.temp_min : 0;
            const tempSwing = day.temp_swing !== undefined ? day.temp_swing : (highTemp - lowTemp);
            const humidity = day.humidity || 0;
            const riskClass = day.risk_level || 'optimal';
            
            // Build exceptions HTML
            let exceptionsHTML = '';
            const exceptions = day.species_exceptions || {};
            const exceptionKeys = Object.keys(exceptions);
            
            if (exceptionKeys.length === 0) {
                exceptionsHTML = '<div class="no-exceptions">✓ All species within normal ranges</div>';
            } else {
                exceptionKeys.forEach(spKey => {
                    const spData = exceptions[spKey];
                    if (spData && spData.exceptions && Array.isArray(spData.exceptions)) {
                        exceptionCount++;
                        spData.exceptions.forEach(exc => {
                            let excClass = 'exception-item';
                            
                            // Heat alerts - 3 levels
                            if (exc.includes('❄️ CRITICAL FROST')) excClass += ' critical-cold';
                            else if (exc.includes('❄️ FROST WARNING')) excClass += ' frost';
                            else if (exc.includes('🧊 COLD STRESS')) excClass += ' cold';
                            else if (exc.includes('🧊 Cool temps')) excClass += ' cool';
                            else if (exc.includes('🔥 Heat stress')) excClass += ' heat-critical';
                            else if (exc.includes('🔥 Heat warning')) excClass += ' heat-warning';
                            else if (exc.includes('🔥')) excClass += ' heat';
                            else if (exc.includes('🦠')) excClass += ' rot';
                            else if (exc.includes('💧') || exc.includes('🌙')) excClass += ' humidity';
                            else if (exc.includes('📊')) excClass += ' volatility';
                            else if (exc.includes('🌡️')) excClass += ' soil';
                            
                            const commonName = spData.common_name || spKey;
                            const iconChar = exc.split(' ')[0];
                            const restOfText = exc.substring(exc.indexOf(' ') + 1);
                            
                            exceptionsHTML += `<div class="${excClass}">
                                <span class="exception-icon">${iconChar}</span>
                                <span class="exception-text">
                                    <span class="exception-species">${commonName}</span>
                                    ${restOfText}
                                </span>
                            </div>`;
                        });
                    }
                });
            }
            
            html += `<div class="forecast-card ${riskClass}">
                <div class="forecast-header">
                    <div class="day-section">
                        <div class="day">${day.day_of_week || 'Unknown'}</div>
                        <div class="date">${day.date || ''}</div>
                        <div class="weather-main">${icon} ${weatherDesc}</div>
                    </div>
                    <div class="level-badge ${riskClass}">${riskClass}</div>
                </div>
                
                <div class="weather-grid">
                    <div class="weather-item">
                        <div class="weather-label">High</div>
                        <div class="weather-value">${Math.round(highTemp)}°</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-label">Low</div>
                        <div class="weather-value">${Math.round(lowTemp)}°</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-label">Swing</div>
                        <div class="weather-value">${Math.round(tempSwing)}°</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-label">Humidity</div>
                        <div class="weather-value">${Math.round(humidity)}%</div>
                    </div>
                    <div class="weather-item">
                        <div class="weather-label">Precip</div>
                        <div class="weather-value">${precip}"</div>
                    </div>
                </div>
                
                <div class="species-advice-container">
                    <div class="daily-note">${day.daily_note || ''}</div>
                    <div class="exceptions-section">${exceptionsHTML}</div>
                </div>
            </div>`;
        });
        
        forecastDiv.innerHTML = html;
        
        console.log('Rendered', advisories.length, 'days,', exceptionCount, 'exception groups');
        
        if (statusDiv) {
            statusDiv.innerHTML = `<b style="color: green;">✓ Rendered ${advisories.length} days (${exceptionCount} exception groups)</b>`;
        }
    } catch (e) {
        console.error('Render error:', e);
        forecastDiv.innerHTML = `<div style="padding: 20px; color: red;">Error rendering forecast: ${e.message}</div>`;
        if (statusDiv) statusDiv.textContent = 'Render Error: ' + e.message;
    }
}
