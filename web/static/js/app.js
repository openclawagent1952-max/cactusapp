/**
 * Cactus Weather Advisor - v2.0
 */

let selectedSpecies = ['pachanoi', 'peruvianus', 'bridgesii'];

document.addEventListener('DOMContentLoaded', () => {
    const locationInput = document.getElementById('location-input');
    if (locationInput && !locationInput.value) {
        locationInput.value = 'Denver, Colorado';
    }
    setupEventListeners();
    fetchForecast();
});

function getUVInfo(uv) {
    if (uv <= 2) return {level: 'Low', color: '#22c55e'};
    if (uv <= 5) return {level: 'Moderate', color: '#eab308'};
    if (uv <= 7) return {level: 'High', color: '#f97316'};
    if (uv <= 10) return {level: 'Very High', color: '#dc2626'};
    return {level: 'Extreme', color: '#7c3aed'};
}

function setupEventListeners() {
    const input = document.getElementById('location-input');
    const btn = document.getElementById('search-btn');
    
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchForecast();
        });
    }
    
    if (btn) {
        btn.addEventListener('click', fetchForecast);
    }
}

async function fetchForecast() {
    const input = document.getElementById('location-input');
    const location = input ? input.value : 'Denver, Colorado';
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const forecast = document.getElementById('forecast');
    
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';
    
    try {
        const url = `/api/forecast?location=${encodeURIComponent(location)}&species=${selectedSpecies.join(',')}`;
        const resp = await fetch(url);
        const data = await resp.json();
        
        if (loading) loading.style.display = 'none';
        
        if (data.error) {
            if (forecast) forecast.innerHTML = `<div class="error">Error: ${data.error}</div>`;
            return;
        }
        
        if (!data.daily_advisories || data.daily_advisories.length === 0) {
            if (forecast) forecast.innerHTML = `<div class="error">No forecast data available</div>`;
            return;
        }
        
        if (results) results.style.display = 'block';
        
        renderCurrent(data.current);
        renderForecast(data.daily_advisories, data.units);
    } catch (e) {
        if (loading) loading.style.display = 'none';
        if (forecast) forecast.innerHTML = `<div class="error">Failed to load: ${e.message}</div>`;
    }
}

function renderCurrent(current) {
    const div = document.getElementById('current');
    if (!div) return;
    
    const uvInfo = getUVInfo(current.uv_index || 0);
    
    div.innerHTML = `
        <div class="current-header">
            <div class="current-location">📍 ${current.location?.city || 'Unknown'}, ${current.location?.region || 'Unknown'}</div>
            <div class="current-temp">${Math.round(current.temp || 0)}${current.temp_symbol || '°F'}</div>
        </div>
        <div class="current-details">
            <div>💧 ${current.humidity || 0}% Humidity</div>
            <div>🌬️ ${Math.round(current.wind || 0)} ${current.speed_symbol || 'mph'} Wind</div>
            <div>☁️ ${current.cloudcover || 0}% Cloud</div>
            <div>☀️ <span style="color:${uvInfo.color}">${current.uv_index || 0} UV (${uvInfo.level})</span></div>
        </div>
    `;
}

function renderForecast(days, units) {
    const div = document.getElementById('forecast');
    if (!div) return;
    
    let html = '';
    
    days.forEach(day => {
        const uvInfo = getUVInfo(day.uv_index || 0);
        
        html += `
            <div class="forecast-card ${day.risk_level || 'optimal'}">
                <div class="forecast-header">
                    <div>
                        <div class="day-name">${day.day_of_week || 'Unknown'}</div>
                        <div class="day-date">${day.date || ''}</div>
                    </div>
                    <div class="risk-badge ${day.risk_level || 'optimal'}">${day.risk_level || 'optimal'}</div>
                </div>
                
                <div class="weather-grid">
                    <div class="weather-cell">
                        <div class="cell-label">High</div>
                        <div class="cell-value">${Math.round(day.temp_max || 0)}°</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Low</div>
                        <div class="cell-value">${Math.round(day.temp_min || 0)}°</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">UV</div>
                        <div class="cell-value" style="color:${uvInfo.color}">${(day.uv_index || 0).toFixed(1)}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Wind</div>
                        <div class="cell-value">${Math.round(day.wind || 0)} ${units?.speed_symbol || 'mph'}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Rain</div>
                        <div class="cell-value">${(day.precipitation || 0).toFixed(1)}${units?.precip_symbol || '"'}</div>
                    </div>
                    <div class="weather-cell">
                        <div class="cell-label">Humidity</div>
                        <div class="cell-value">${day.humidity || 0}%</div>
                    </div>
                </div>
                
                <div class="daily-note">${day.daily_note || ''}</div>
            </div>
        `;
    });
    
    div.innerHTML = html;
}

window.fetchForecast = fetchForecast;
