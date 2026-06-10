# Cactus Weather Advisor 2.0 - Development Roadmap

## New Features

### 1. Enhanced Weather Data
- **UV Index**: Track UV intensity for sun stress warnings
- **Wind Chill**: "Feels like" temperature for cold stress
- **Heat Index**: "Feels like" temperature for heat stress
- **Soil Temperature**: Better estimation or premium API

### 2. Seasonal Patterns
- **First/Last Frost Tracking**: Historical and predicted dates
- **Frost Countdown**: "X days until first frost risk"
- **Seasonal Alerts**: "Prepare for dormancy" notifications
- **Growing Season Calendar**: Visual timeline

### 3. Custom Species Management
- **Add Species Form**: Input all parameters manually
- **Species Database**: CRUD operations for custom species
- **Import/Export**: Share species configurations
- **Community Species**: Optional sharing of user-created species

### 4. UI/UX Improvements
- **Temperature Graphs**: 7-day trend visualization
- **Dashboard View**: At-a-glance summary
- **Risk Calendar**: Monthly heatmap
- **Location Comparison**: Side-by-side forecasts

## Database Changes

### New Table: custom_species
```sql
CREATE TABLE custom_species (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    key TEXT UNIQUE,
    common_names TEXT, -- JSON array
    latin_name TEXT,
    notes TEXT,
    origin TEXT,
    temp_optimal_day_min_c REAL,
    temp_optimal_day_max_c REAL,
    frost_threshold_c REAL,
    heat_stress_c REAL,
    humidity_min INTEGER,
    humidity_max INTEGER,
    uv_sensitive BOOLEAN,
    wind_tolerance TEXT,
    created_at TIMESTAMP
);
```

### New Table: user_locations
```sql
CREATE TABLE user_locations (
    id INTEGER PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    lat REAL,
    lon REAL,
    is_default BOOLEAN,
    species TEXT -- JSON array of selected species keys
);
```

## API Changes

### Extended Weather Parameters
```
&daily=uv_index_max,apparent_temperature_max,apparent_temperature_min,soil_temperature_0cm
```

### New Endpoints
- `POST /api/species` - Add custom species
- `PUT /api/species/:id` - Update species
- `DELETE /api/species/:id` - Delete species
- `GET /api/seasonal/:location` - Get frost dates
- `POST /api/locations` - Save location

## Frontend Changes

### New Components
- `SpeciesForm.vue` - Add/edit species
- `SeasonalView.vue` - Frost calendar
- `TempChart.vue` - Temperature graph
- `UVCard.vue` - UV index display
- `WindChillCard.vue` - Wind chill display

### New Routes
- `/species/new` - Add species form
- `/species/:id/edit` - Edit species
- `/seasonal` - Seasonal patterns view
- `/dashboard` - Enhanced dashboard

## Implementation Phases

### Phase 1: Enhanced Weather (Week 1)
- [ ] Add UV, Wind Chill, Heat Index to API
- [ ] Update species database with UV/wind sensitivity
- [ ] Create new alert types for UV/wind stress

### Phase 2: Seasonal Patterns (Week 2)
- [ ] Historical weather analysis for frost dates
- [ ] Frost countdown display
- [ ] Seasonal calendar view

### Phase 3: Custom Species (Week 3)
- [ ] Database schema
- [ ] CRUD API endpoints
- [ ] Species form UI
- [ ] Validation

### Phase 4: Polish & Testing (Week 4)
- [ ] Temperature graphs
- [ ] Dashboard improvements
- [ ] Testing
- [ ] Documentation
