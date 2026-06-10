/**
 * Cactus Weather Advisor - v2.0 DEBUG
 */

console.log('JS DEBUG v2.0 -', new Date().toISOString());

let selectedSpecies = ['pachanoi', 'peruvianus', 'bridgesii'];

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM ready');
    
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
    console.log('fetchForecast() called');
    
    const input = document.getElementById('location-input');
    const location = input ? input.value : 'Denver, Colorado';
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const forecast = document.getElementById('forecast');
    
    console.log('Elements found:', {loading: !!loading, results: !!results, forecast: !!forecast});
    
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';
    
    try {
        const url = `/api/forecast?location=${encodeURIComponent(location)}&species=${selectedSpecies.join(',')}`;
        console.log('Fetching:', url);
        
        const resp = await fetch(url);
        console.log('Response status:', resp.status);
        
        const data = await resp.json();
        console.log('Data received:', typeof data);
        console.log('Data keys:', Object.keys(data));
        console.log('Has daily_advisories:', 'daily_advisories' in data);
        console.log('daily_advisories length:', data.daily_advisories?.length);
        
        if (loading) loading.style.display = 'none';
        
        if (data.error) {
            console.error('API error:', data.error);
            if (forecast) forecast.innerHTML = `<div class="error">API Error: ${data.error}</div>`;
            return;
        }
        
        if (!data.daily_advisories) {
            console.error('Missing daily_advisories');
            if (forecast) forecast.innerHTML = `<div class="error">Missing daily_advisories</div>`;
            return;
        }
        
        if (data.daily_advisories.length === 0) {
            console.error('Empty daily_advisories');
            if (forecast) forecast.innerHTML = `<div class="error">Empty daily_advisories</div>`;
            return;
        }
        
        if (results) results.style.display = 'block';
        
        // Render current
        if (data.current) {
            console.log('Rendering current weather');
            renderCurrent(data.current);
        }
        
        // Render forecast
        console.log('Rendering forecast');
        renderForecast(data.daily_advisories, data.units);
        
    } catch (e) {
        console.error('Fetch error:', e);
        console.error('Error stack:', e.stack);
        if (loading) loading.style.display = 'none';
        if (forecast) forecast.innerHTML = `<div class="error">Error: ${e.message}</div>`;
    }
}

function renderCurrent(current) {
    console.log('renderCurrent called');
    const div = document.getElementById('current');
    if (!div) {
        console.error('current element not found');
        return;
    }
    
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
    console.log('renderForecast called with', days?.length, 'days');
    const div = document.getElementById('forecast');
    if (!div) {
        console.error('forecast element not found');
        return;
    }
    
    let html = '';
    
    days.forEach((day, idx) => {
        console.log('Rendering day', idx, day.day_of_week);
        
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
                </div>
                
                <div class="daily-note">${day.daily_note || ''}</div>
            </div>
        `;
    });
    
    console.log('Setting HTML, length:', html.length);
    div.innerHTML = html;
    console.log('Forecast rendered');
}

window.fetchForecast = fetchForecast;
