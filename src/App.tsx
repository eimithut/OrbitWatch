/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import GlobeView from './components/GlobeView';
import Lobby from './components/Lobby';
import { SatelliteData, fetchSatellites, fetchPeopleInSpace, isAboveHorizon } from './services/satelliteService';
import { Launch, fetchUpcomingLaunches } from './services/launchService';
import { motion, AnimatePresence } from 'motion/react';
import { Satellite, Activity, Ruler, Clock, Search, ArrowLeft, Rocket, MapPin, X, Calendar, Info, Users, LayoutGrid, Eye, Share2, Network } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'lobby' | 'satellites' | 'launches'>('lobby');
  const [loading, setLoading] = useState(false);
  
  // Data State
  const [satellites, setSatellites] = useState<SatelliteData[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  
  // Interaction State
  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedSatId, setFocusedSatId] = useState<string | null>(null);
  
  const [selectedLaunchId, setSelectedLaunchId] = useState<string | null>(null);
  const [launchFilter, setLaunchFilter] = useState<string>('all'); // 'all', 'SpaceX', 'NASA', etc.
  const [satelliteFilter, setSatelliteFilter] = useState<string>('all'); // 'all', 'Station', 'Starlink', 'GPS', 'GEO'
  const [showConstellationLines, setShowConstellationLines] = useState(false);
  const [showISSFeed, setShowISSFeed] = useState(false);
  const [isSkyView, setIsSkyView] = useState(false);

  // Get User Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Geolocation denied", err)
      );
    }
  }, []);

  const visibleSatellites = useMemo(() => {
    if (!userLocation) return [];
    return satellites
      .filter(sat => isAboveHorizon(sat, { ...userLocation, alt: 0 }))
      .sort((a, b) => b.alt - a.alt); // Sort by altitude for now
  }, [satellites, userLocation]);

  // Load Data based on mode
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (viewMode === 'satellites' && satellites.length === 0) {
          const [stations, brightest, starlink, gps, geo, peopleInSpace] = await Promise.all([
            fetchSatellites('stations', 'station'),
            fetchSatellites('brightest', 'satellite'),
            fetchSatellites('starlink', 'starlink'),
            fetchSatellites('gps-ops', 'gps'),
            fetchSatellites('geo', 'geo'),
            fetchPeopleInSpace()
          ]);

          // Merge people count into stations
          const stationsWithPeople = stations.map(station => {
            // Check for known station names (ISS, Tiangong)
            let peopleCount = 0;
            if (station.name.includes('ISS') || station.name.includes('ZARYA')) {
               peopleCount = peopleInSpace['ISS (ZARYA)'] || 7;
            } else if (station.name.includes('TIANGONG') || station.name.includes('CSS')) {
               peopleCount = peopleInSpace['TIANGONG'] || 3;
            }
            
            return {
              ...station,
              people: peopleCount > 0 ? peopleCount : undefined
            };
          });

          setSatellites([
            ...stationsWithPeople,
            ...brightest.slice(0, 50),
            ...starlink.slice(0, 1500),
            ...gps,
            ...geo.slice(0, 300)
          ]);
        } else if (viewMode === 'launches' && launches.length === 0) {
          const upcoming = await fetchUpcomingLaunches();
          setLaunches(upcoming);
        }
      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setLoading(false);
      }
    };

    if (viewMode !== 'lobby') {
      loadData();
    }
  }, [viewMode]);

  // Filtered Satellites for Display
  const filteredSatellites = useMemo(() => {
    if (satelliteFilter === 'all') return satellites;
    return satellites.filter(s => s.type.toLowerCase() === satelliteFilter.toLowerCase() || (satelliteFilter === 'Station' && s.type === 'station'));
  }, [satellites, satelliteFilter]);

  // Filtered Satellites for Search
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return satellites.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);
  }, [searchQuery, satellites]);

  // Filtered Launches
  const filteredLaunches = useMemo(() => {
    if (launchFilter === 'all') return launches;
    
    return launches.filter(l => {
      const provider = l.launch_service_provider.name.toLowerCase();
      const filter = launchFilter.toLowerCase();
      
      if (filter === 'nasa') {
        return provider.includes('nasa') || provider.includes('national aeronautics and space administration');
      }
      
      if (filter === 'esa') {
        return provider.includes('esa') || provider.includes('european space agency') || provider.includes('arianespace');
      }
      
      return provider.includes(filter);
    });
  }, [launches, launchFilter]);

  const selectedLaunch = useMemo(() => {
    return launches.find(l => l.id === selectedLaunchId);
  }, [launches, selectedLaunchId]);

  // Handlers
  const handleSearchSelect = (sat: SatelliteData) => {
    setFocusedSatId(sat.id);
    setSearchQuery(''); // Clear search
  };

  const handleLaunchSelect = (launchId: string) => {
    setSelectedLaunchId(launchId);
  };

  const handleSatelliteSelect = (satId: string) => {
    setFocusedSatId(satId);
  };

  if (viewMode === 'lobby') {
    return <Lobby onSelectMode={setViewMode} />;
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-gray-100">
      {/* 3D Globe Layer */}
      <div className="absolute inset-0 z-0">
        <GlobeView 
          mode={viewMode}
          satellites={filteredSatellites}
          launches={launches}
          onHoverSatellite={setHoveredSat}
          focusedSatelliteId={focusedSatId}
          selectedLaunchId={selectedLaunchId}
          showConstellationLines={showConstellationLines}
          userLocation={userLocation}
          isSkyView={isSkyView}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
        
        {/* Header & Navigation */}
        <header className="flex flex-col md:flex-row justify-between items-start gap-4 pointer-events-auto">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewMode('lobby')}
              className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl hover:bg-white/10 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </button>
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 px-5 rounded-xl shadow-lg">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                {viewMode === 'satellites' ? (
                  <><Satellite className="w-5 h-5 text-emerald-400" /> Satellite Tracker</>
                ) : (
                  <><Rocket className="w-5 h-5 text-rose-400" /> Launch Schedule</>
                )}
              </h1>
            </div>
          </div>

          {/* Search Bar (Only for Satellites) */}
          {viewMode === 'satellites' && (
            <div className="relative w-full md:w-80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search satellites..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                  >
                    {searchResults.map(sat => (
                      <button
                        key={sat.id}
                        onClick={() => handleSearchSelect(sat)}
                        className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center justify-between group"
                      >
                        <span className="text-sm font-medium text-gray-200 group-hover:text-white">{sat.name}</span>
                        <span className="text-[10px] uppercase text-gray-500 bg-white/5 px-2 py-0.5 rounded">{sat.type}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* All Projects Button */}
          <motion.a
            href="https://eimithut.pages.dev"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-black/40 backdrop-blur-md border border-white/10 p-3 px-4 rounded-xl hover:bg-white/10 transition-colors group flex items-center gap-2 pointer-events-auto"
          >
            <LayoutGrid className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors hidden md:inline">All Projects</span>
          </motion.a>
        </header>

        {/* Satellite Filters (Only for Satellites) */}
        {viewMode === 'satellites' && (
          <div className="absolute top-24 left-4 md:left-6 flex flex-col gap-2 pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 flex gap-2 overflow-x-auto no-scrollbar max-w-[calc(100vw-2rem)]">
              {['all', 'Station', 'Starlink', 'GPS', 'GEO'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setSatelliteFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    satelliteFilter === filter 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {filter === 'all' ? 'All Satellites' : filter}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowConstellationLines(!showConstellationLines)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                  showConstellationLines ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-black/40 border-white/10 text-gray-400'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                Connect Constellations
              </button>

              <button
                onClick={() => setIsSkyView(!isSkyView)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border ${
                  isSkyView ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-black/40 border-white/10 text-gray-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {isSkyView ? 'Exit Sky View' : 'Sky View (AR)'}
              </button>
            </div>
          </div>
        )}

        {/* Satellite List Sidebar (Only for Satellites) */}
        {viewMode === 'satellites' && (
          <div className="absolute top-44 left-4 md:left-6 bottom-6 w-80 pointer-events-auto flex flex-col gap-4">
            <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 space-y-2 no-scrollbar">
              {/* Visible Tonight Section */}
              {visibleSatellites.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-2 py-1 mb-2">
                    <Eye className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Visible Tonight</span>
                  </div>
                  {visibleSatellites.slice(0, 5).map(sat => (
                    <button
                      key={`visible-${sat.id}`}
                      onClick={() => handleSatelliteSelect(sat.id)}
                      className={`w-full text-left p-2 rounded-lg border transition-all mb-1 ${
                        focusedSatId === sat.id 
                          ? 'bg-emerald-500/20 border-emerald-500/50' 
                          : 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white truncate">{sat.name}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">{(sat.alt).toFixed(0)}km</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 px-2 py-1 mb-2">
                <Satellite className="w-3 h-3 text-gray-500" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">All Satellites</span>
              </div>
              
              {filteredSatellites.slice(0, 50).map(sat => (
                <button
                  key={sat.id}
                  onClick={() => handleSatelliteSelect(sat.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all ${
                    focusedSatId === sat.id 
                      ? 'bg-emerald-500/20 border-emerald-500/50' 
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-300 truncate">{sat.name}</span>
                    <span className="text-[10px] text-gray-600 font-mono">{(sat.alt).toFixed(0)}km</span>
                  </div>
                </button>
              ))}
              {filteredSatellites.length > 50 && (
                <p className="text-[10px] text-gray-600 text-center py-2 italic">
                  Showing top 50 of {filteredSatellites.length} satellites
                </p>
              )}
            </div>
          </div>
        )}

        {/* Launch List Sidebar (Only for Launches) */}
        {viewMode === 'launches' && (
          <div className="absolute top-24 left-4 md:left-6 bottom-6 w-80 pointer-events-auto flex flex-col gap-4">
            {/* Filters */}
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 flex gap-2 overflow-x-auto no-scrollbar">
              {['all', 'SpaceX', 'NASA', 'Rocket Lab', 'ESA'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setLaunchFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    launchFilter === filter 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {filter === 'all' ? 'All Providers' : filter}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-2 space-y-2 no-scrollbar">
              {filteredLaunches.map(launch => (
                <button
                  key={launch.id}
                  onClick={() => handleLaunchSelect(launch.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedLaunchId === launch.id 
                      ? 'bg-rose-500/10 border-rose-500/50' 
                      : 'bg-white/5 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                      {launch.launch_service_provider.name}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-black/40 px-1.5 py-0.5 rounded">
                      {new Date(launch.net).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1 line-clamp-1">{launch.name}</h3>
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{launch.pad.location.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Launch Details Panel (Only for Launches) */}
        <AnimatePresence>
          {viewMode === 'launches' && selectedLaunch && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-24 right-4 md:right-6 bottom-6 w-80 md:w-96 pointer-events-auto"
            >
              <div className="h-full bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-bold text-white leading-tight pr-4">
                    {selectedLaunch.name}
                  </h2>
                  <button 
                    onClick={() => setSelectedLaunchId(null)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      selectedLaunch.status.abbrev === 'Go' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {selectedLaunch.status.name}
                    </span>
                    <span className="text-sm text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedLaunch.net).toLocaleString()}
                    </span>
                  </div>

                  {/* Mission Description */}
                  {selectedLaunch.mission && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <Info className="w-4 h-4" /> Mission
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {selectedLaunch.mission.description}
                      </p>
                    </div>
                  )}

                  {/* Location */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Launch Site
                    </h3>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <p className="text-sm text-white font-medium">{selectedLaunch.pad.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedLaunch.pad.location.name}</p>
                    </div>
                  </div>

                  {/* Provider */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                      <Rocket className="w-4 h-4" /> Provider
                    </h3>
                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <p className="text-sm text-white font-medium">{selectedLaunch.launch_service_provider.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedLaunch.launch_service_provider.type}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Satellite Info Panel (Only for Satellites) */}
        <AnimatePresence>
          {viewMode === 'satellites' && hoveredSat && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-8 right-4 md:right-8 w-full md:w-80 pointer-events-auto"
            >
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                  <h2 className="text-xl font-bold text-white truncate pr-4" title={hoveredSat.name}>
                    {hoveredSat.name}
                  </h2>
                  <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                    hoveredSat.type === 'station' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {hoveredSat.type}
                  </span>
                </div>

                <div className="space-y-4 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Ruler className="w-4 h-4" />
                      <span>Altitude</span>
                    </div>
                    <span className="text-white font-medium">
                      {hoveredSat.alt.toFixed(2)} <span className="text-gray-500 text-xs">km</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Activity className="w-4 h-4" />
                      <span>Velocity</span>
                    </div>
                    <span className="text-white font-medium">
                      {hoveredSat.velocity.toFixed(2)} <span className="text-gray-500 text-xs">km/s</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>Lat/Lng</span>
                    </div>
                    <span className="text-white font-medium text-xs">
                      {hoveredSat.lat.toFixed(2)}°, {hoveredSat.lng.toFixed(2)}°
                    </span>
                  </div>

                  {hoveredSat.people !== undefined && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Users className="w-4 h-4" />
                        <span>People on Board</span>
                      </div>
                      <span className="text-white font-bold text-lg">
                        {hoveredSat.people}
                      </span>
                    </div>
                  )}

                  {/* Visibility Alert */}
                  {userLocation && isAboveHorizon(hoveredSat, { ...userLocation, alt: 0 }) && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 flex items-center gap-2 mt-2">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 text-[10px] font-bold uppercase">Visible from your location now!</span>
                    </div>
                  )}

                  {/* ISS Live Feed Toggle */}
                  {(hoveredSat.name.includes('ISS') || hoveredSat.name.includes('ZARYA')) && (
                    <button 
                      onClick={() => setShowISSFeed(!showISSFeed)}
                      className="w-full mt-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      {showISSFeed ? 'Close Live Feed' : 'View ISS Live Feed'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ISS Live Feed Modal */}
        <AnimatePresence>
          {showISSFeed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto"
            >
              <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden w-full max-w-3xl shadow-2xl">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h3 className="text-white font-bold flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-emerald-400" /> ISS Live Stream (NASA)
                  </h3>
                  <button onClick={() => setShowISSFeed(false)} className="p-1 hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="aspect-video w-full bg-black">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://www.youtube.com/embed/xRPjKQtRXR8?autoplay=1&mute=1" 
                    title="ISS Live Feed"
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  ></iframe>
                </div>
                <div className="p-4 text-xs text-gray-500 text-center">
                  Live views of Earth from the International Space Station.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              <p className="text-white font-mono text-sm">Loading Data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
