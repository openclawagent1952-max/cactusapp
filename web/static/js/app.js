/**
 * Cactus Weather Advisor - v2.0 Frontend
 * Cache-busted: v10 - UV + Apparent Temp + Wind
 */

console.log('JS Loaded: v10 - UV + Apparent Temp + Wind -', new Date().toISOString());

let selectedSpecies = ['pachanoi', 'peruvianus', 'bridgesii'];

document.addEventListener('DOMContentLoaded', () => {
    const cacheInfo = document.getElementById('cache-info');
    if (cacheInfo) {
        cacheInfo.textContent = 'JS v10 (UV + wind) loaded at ' + new Date().toLocaleTimeString();
    }
    
    const locationInput = document.getElementById('location-input');
    if (locationInput && !locationInput.value) {
        locationInput.value = 'Denver, Colorado';
    }
    
    loadSpecies('Denver, Colorado');
    setupEventListeners();
    fetchForecast();
});

function getWeatherDesc(code) {
    const codes = {
        0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
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
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
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

function getUVInfo(uv) {
    if (uv <= 2) return { level: 'Low', color: '#22c55e' };
    if (uv <= 5) return { level: 'Moderate', color: '#eab308' };
    if (uv <= 7) return { level: 'High', color: '#f97316' };
    if (uv <= 10) return { level: 'Very High', color: '#dc2626' };
    return { level: 'Extreme', color: '#7c3aed' };
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
    
    let html = '<h3 style="margin: 16px 0 8px 0; color: var(--hunter-green); font-size: 0.9rem;">Core Species</h3>';
    html += '<div class="core-species-grid">';
    html += coreSpecies.map(s => renderSpeciesCard(s, true)).join('');
    html += '</div>';
    
    html += '<h3 style="margin: 24px 0 8px 0; color: var(--hunter-green); font-size: 0.9rem;">Additional Species</h3>';
    html += '<div class="additional-species-grid">';
    html += additionalSpecies.map(s => renderSpeciesCard(s, false)).join('');
    html += '</div>';
    
    html += `<div style="margin-top: 20px; text-align: center;">
        <a href="/species/new" style="display: inline-block; padding: 10px 20px; border: 2px solid var(--fern); border-radius: 8px; text-decoration: none; color: var(--hunter-green); font-size: 0.9rem;">+ Add Custom Species</a>
    </div>`;
    
    grid.innerHTML = html;
}

function renderSpeciesCard(s, isCore) {
    const key = s.key.replace('trichocereus_', '');
    const isSelected = selectedSpecies.includes(key);
    const p = s.preferred_params;
    
    return `
        <div class="species-card ${isSelected ? 'selected' : ''} ${isCore ? '' : 'additional'}" data-key="${key}" onclick="toggleSpecies('${key}')">
            <div class="species-header">
                <span class="species-name">${s.name}</span>
                ${isSelected ? '<span class="check">✓</span>' : ''}
            </div>
            <div class="species-params">
                <div class="param">☀️ ${p.temp_day_range[0]}°-${p.temp_day_range[1]}°</div>
                <div class="param">❄️ ${p.frost_threshold}°</div>
                <div class="param">🔥 ${p.heat_stress}°</div>
                <div class="param">💧 Humidity: ${p.humidity_range[0]}%-${p.humidity_range[1]}%</div>
            </div>
        </div>
    `;
}

function toggleSpecies(key) {
    if (selectedSpecies.includes(key)) {
        if (selectedSpecies.length > 1) {
            selectedSpecies = selectedSpecies.filter(k => k !== key);
        }
    } else {
        selectedSpecies.push(key);
    }
    fetchForecast();
    loadSpecies(document.getElementById('location-input').value || 'Denver, Colorado');
}

function setupEventListeners() {
    const input = document.getElementById('location-input');
    const btn = document.getElementById('search-btn');
    
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fetchForecast();
                loadSpecies(input.value);
            }
        });
    }
    
    if (btn) {
        btn.addEventListener('click', () => {
            fetchForecast();
            loadSpecies(input.value);
        });
    }
}

async function fetchForecast() {
    const input = document.getElementById('location-input');
    const location = input ? input.value : 'Denver, Colorado';
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';
    
    try {
        const params = new URLSearchParams({
            location: location,
            species: selectedSpecies.join(',')
        });
        
        const resp = await fetch(`/api/forecast?${params}`);
        const data = await resp.json();
        
        if (loading) loading.style.display = 'none';
        
        if (data.error) {
            const forecast = document.getElementById('forecast');
            if (forecast) forecast.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }
        
        if (results) results.style.display = 'block';
        renderCurrent(data.current);
        renderForecast(data.daily_advisories, data.units);
    } catch (e) {
        if (loading) loading.style.display = 'none';
        const forecast = document.getElementById('forecast');
        if (forecast) forecast.innerHTML = `<div class="error">Failed to load forecast: ${e.message}</div>`;
        console.error(e);
    }
}

function renderCurrent(current) {
    const div = document.getElementById('current');
    if (!div) return;
    
    const uvInfo = getUVInfo(current.uv_index || 0);
    
    div.innerHTML = `
        <div class="current-header">
            <div class="current-location">📍 ${current.location.city}, ${current.location.region}</div>
            <div class="current-main">
                <div class="current-icon">☀️</div>
                <div class="current-temp">${Math.round(current.temp)}${current.temp_symbol}</div>
            </div>
        </div>
        <div class="current-details">
            <div class="detail-item">
                <span class="detail-icon">💧</span>
                <span class="detail-value">${current.humidity}% Humidity</span>
            </div>
            <div class="detail-item">
                <span class="detail-icon">🌬️</span>
                <span class="detail-value">${Math.round(current.wind)} ${current.speed_symbol} Wind</span>
            </div>
            <div class="detail-item">
                <span class="detail-icon">☁️</span>
                <span class="detail-value">${current.cloudcover}% Cloud Cover</span>
            </div>
            <div class="detail-item">
                <span class="detail-icon">☀️</span>
                <span class="detail-value" style="color: ${uvInfo.color}">${current.uv_index || 0} UV (${uvInfo.level})</span>
            </div>
        </div>
    `;
}

function renderForecast(days, units) {
    const div = document.getElementById('forecast');
    if (!div) return;
    
    if (!days || days.length === 0) {
        div.innerHTML = '<div class="error">No forecast data available</div>';
        return;
    }
    
    let html = '';
    
    days.forEach((day, index) => {
        const highTemp = day.temp_max;
        const lowTemp = day.temp_min;
        const apparentHigh = day.apparent_temp_max || highTemp;
        const apparentLow = day.apparent_temp_min || lowTemp;
        const uvIndex = day.uv_index || 0;
        const uvInfo = getUVInfo(uvIndex);
        const riskClass = day.risk_level || 'optimal';
        const weatherDesc = getWeatherDesc(day.weather_code);
        const icon = getWeatherIcon(day.weather_code);
        const exceptions = day.species_exceptions || {};
        const exceptionKeys = Object.keys(exceptions);
        
        // Build collapsible alerts
        let exceptionsHTML = '';
        if (exceptionKeys.length > 0) {
            let allAlerts = [];
            
            const getSeverity = (exc) => {
                if (exc.includes('CRITICAL FROST')) return 10;
                if (exc.includes('EXTREME UV')) return 9;
                if (exc.includes('Soil freeze risk')) return 9;
                if (exc.includes('High wind')) return 8;
                if (exc.includes('Heat stress')) return 8;
                if (exc.includes('FROST WARNING')) return 7;
                if (exc.includes('Heat warning')) return 6;
                if (exc.includes('COLD STRESS')) return 5;
                if (exc.includes('High UV')) return 5;
                if (exc.includes('wind chill')) return 5;
                if (exc.includes('heat index')) return 5;
                if (exc.includes('Extreme temp swing')) return 4;
                if (exc.includes('Large temp swing')) return 3;
                return 1;
            };
            
            exceptionKeys.forEach(spKey => {
                const spData = exceptions[spKey];
                if (spData && spData.exceptions) {
                    spData.exceptions.forEach(exc => {
                        allAlerts.push({
                            severity: getSeverity(exc),
                            spKey: spKey,
                            commonName: spData.common_name || spKey,
                            exc: exc
                        });
                    });
                }
            });
            
            allAlerts.sort((a, b) => b.severity - a.severity);
            
            const criticalCount = allAlerts.filter(a => a.severity >= 8).length;
            const warningCount = allAlerts.filter(a => a.severity >= 5 && a.severity < 8).length;
            const cautionCount = allAlerts.filter(a => a.severity < 5).length;
            
            let summaryParts = [];
            if (criticalCount > 0) summaryParts.push(`${criticalCount} critical`);
            if (warningCount > 0) summaryParts.push(`${warningCount} warning`);
            if (cautionCount > 0) summaryParts.push(`${cautionCount} caution`);
            
            const dayId = `alerts-${index}`;
            
            exceptionsHTML = `
                <div class="alerts-summary" onclick="toggleAlerts('${dayId}')">
                    <span class="alert-badge ${criticalCount > 0 ? 'danger' : warningCount > 0 ? 'warning' : 'caution'}">
                        ${exceptionKeys.length} species
                    </span>
                    <span class="alert-types">${summaryParts.join(' • ')}</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="alerts-list" id="${dayId}" style="display: none;">
            `;
            
            allAlerts.forEach(alert => {
                const exc = alert.exc;
                let excClass = 'alert-item';
                
                if (exc.includes('❄️ CRITICAL FROST')) excClass += ' critical-cold';
                else if (exc.includes('❄️ FROST WARNING')) excClass += ' frost';
                else if (exc.includes('🧊 COLD STRESS')) excClass += ' cold';
                else if (exc.includes('🔥 Heat stress')) excClass += ' heat-critical';
                else if (exc.includes('🔥 Heat warning')) excClass += ' heat-warning';
                else if (exc.includes('🔥')) excClass += ' heat';
                else if (exc.includes('💧') || exc.includes('🌙')) excClass += ' humidity';
                else if (exc.includes('📊')) excClass += ' volatility';
                else if (exc.includes('🌡️')) excClass += ' soil';
                else if (exc.includes('☀️')) excClass += ' uv';
                else if (exc.includes('🌬️')) excClass += ' wind-chill';
                else if (exc.includes('💨')) excClass += ' wind';
                
                const iconChar = exc.split(' ')[0];
                const restOfText = exc.substring(exc.indexOf(' ') + 1);
                
                exceptionsHTML += `<div class="${excClass}">
                    <span class="alert-icon">${iconChar}</span>
                    <span class="alert-text">
                        <span class="alert-species">${alert.commonName}</span>
                        ${restOfText}
                    </span>
                </div>`;
            });
            
            exceptionsHTML += '</div>';
        }
        
        // Show apparent temp if significantly different
        const showApparent = Math.abs(apparentHigh - highTemp) > 3 || Math.abs(apparentLow - lowTemp) > 3;
        const apparentHighDisplay = showApparent ? `<span class="apparent">(feels ${Math.round(apparentHigh)}°)</span>` : '';
        const apparentLowDisplay = showApparent ? `<span class="apparent">(feels ${Math.round(apparentLow)}°)</span>` : '';
        
        html += `
            <div class="forecast-card ${riskClass}">
                <div class="forecast-header">
                    <div class="forecast-day">
                        <div class="day-name">${day.day_of_week || 'Unknown'}</div>
                        <div class="day-date">${day.date || ''}</div>
                        <div class="day-weather">${icon} ${weatherDesc}</div>
                    </div>
                    <div class="risk-badge ${riskClass}">${riskClass}</div>
                </div>
                
                <div class="weather-grid">
                    <div class="weather-cell">
                        <div class="cell-label">High</div>
                        <div class="cell-value">${Math.round(highTemp)}° ${apparentHighDisplay}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Low</div>
                        <div class="cell-value">${Math.round(lowTemp)}° ${apparentLowDisplay}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">UV</div>
                        <div class="cell-value" style="color: ${uvInfo.color}">${uvIndex.toFixed(1)}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Wind</div>
                        <div class="cell-value">${Math.round(day.wind || 0)} ${units.speed_symbol}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Rain</div>
                        <div class="cell-value">${(day.precipitation || 0).toFixed(1)}${units.precip_symbol}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Humidity</div>
                        <div class="cell-value">${day.humidity || 0}%</div>
                    </div>
                </div>
                
                ${exceptionsHTML}
                
                <div class="daily-note">${day.daily_note || ''}</div>
            </div>
        `;
    });
    
    div.innerHTML = html;
}

function toggleAlerts(dayId) {
    const list = document.getElementById(dayId);
    const summary = list.previousElementSibling;
    const icon = summary.querySelector('.toggle-icon');
    
    if (list.style.display === 'none') {
        list.style.display = 'block';
        icon.textContent = '▲';
    } else {
        list.style.display = 'none';
        icon.textContent = '▼';
    }
}

// Expose to window for onclick handlers
window.toggleSpecies = toggleSpecies;
window.toggleAlerts = toggleAlerts;
