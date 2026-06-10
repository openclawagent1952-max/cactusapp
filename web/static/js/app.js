/**
 * Cactus Weather Advisor - v2.0 Frontend (DEBUG)
 */

console.log('JS DEBUG: v2.0 loaded at', new Date().toISOString());

let selectedSpecies = ['pachanoi', 'peruvianus', 'bridgesii'];

document.addEventListener('DOMContentLoaded', () => {
    console.log('DEBUG: DOM loaded');
    
    const cacheInfo = document.getElementById('cache-info');
    if (cacheInfo) cacheInfo.textContent = 'DEBUG v2.0 loaded';
    
    fetchForecast();
});

async function fetchForecast() {
    console.log('DEBUG: fetchForecast() called');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const forecast = document.getElementById('forecast');
    
    if (loading) loading.style.display = 'block';
    if (results) results.style.display = 'none';
    
    try {
        const url = `/api/forecast?location=Denver&species=${selectedSpecies.join(',')}`;
        console.log('DEBUG: Fetching', url);
        
        const resp = await fetch(url);
        console.log('DEBUG: Response status:', resp.status);
        
        const data = await resp.json();
        console.log('DEBUG: Data keys:', Object.keys(data));
        console.log('DEBUG: Has error:', data.error);
        console.log('DEBUG: Has daily_advisories:', !!data.daily_advisories);
        console.log('DEBUG: daily_advisories length:', data.daily_advisories?.length);
        
        if (loading) loading.style.display = 'none';
        
        if (data.error) {
            console.error('DEBUG: API error:', data.error);
            if (forecast) forecast.innerHTML = `<div class="error">API Error: ${data.error}</div>`;
            return;
        }
        
        if (!data.daily_advisories || data.daily_advisories.length === 0) {
            console.error('DEBUG: No daily_advisories in response');
            if (forecast) forecast.innerHTML = `<div class="error">No forecast data available (empty array)</div>`;
            return;
        }
        
        if (results) results.style.display = 'block';
        
        // Simple render - just show first day
        const day = data.daily_advisories[0];
        console.log('DEBUG: First day:', day);
        
        if (forecast) {
            forecast.innerHTML = `
                <div class="forecast-card">
                    <h3>${day.day_of_week} - ${day.date}</h3>
                    <p>High: ${day.temp_max}° | Low: ${day.temp_min}°</p>
                    <p>UV: ${day.uv_index} | Wind: ${day.wind} mph</p>
                    <p>${day.daily_note}</p>
                </div>
            `;
        }
        
    } catch (e) {
        console.error('DEBUG: Fetch error:', e);
        if (loading) loading.style.display = 'none';
        if (forecast) forecast.innerHTML = `<div class="error">Fetch failed: ${e.message}</div>`;
    }
}

window.fetchForecast = fetchForecast;
