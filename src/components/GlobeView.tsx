import React, { useEffect, useState, useRef, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { propagateSatellite, getTrajectory, SatelliteData, getTerminatorPath } from '../services/satelliteService';
import { Launch } from '../services/launchService';
import * as THREE from 'three';

const EARTH_RADIUS_KM = 6371;
const SAT_SIZE = 1.5; // Visual size multiplier

interface GlobeViewProps {
  mode: 'lobby' | 'satellites' | 'launches';
  satellites?: SatelliteData[];
  launches?: Launch[];
  onHoverSatellite?: (sat: SatelliteData | null) => void;
  onHoverLaunch?: (launch: Launch | null) => void;
  focusedSatelliteId?: string | null;
  selectedLaunchId?: string | null;
  showConstellationLines?: boolean;
  userLocation?: { lat: number, lng: number } | null;
  isSkyView?: boolean;
}

const GlobeView: React.FC<GlobeViewProps> = ({ 
  mode, 
  satellites = [], 
  launches = [], 
  onHoverSatellite, 
  onHoverLaunch,
  focusedSatelliteId,
  selectedLaunchId,
  showConstellationLines = false,
  userLocation = null,
  isSkyView = false
}) => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [time, setTime] = useState(new Date());
  const [hoveredSat, setHoveredSat] = useState<SatelliteData | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [landPolygons, setLandPolygons] = useState([]);
  const [terminatorData, setTerminatorData] = useState<any[]>([]);

  // Load Land Polygons for Minimalistic Map
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => setLandPolygons(data.features))
      .catch(err => console.error('Failed to load land polygons:', err));
  }, []);

  // Update Terminator
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTerminatorData([{ path: getTerminatorPath(now) }]);
    }, 10000);
    setTerminatorData([{ path: getTerminatorPath(new Date()) }]);
    return () => clearInterval(timer);
  }, []);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update positions loop (only for satellites)
  useEffect(() => {
    if (mode !== 'satellites') return;
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000); // Update every second
    return () => clearInterval(interval);
  }, [mode]);

  // Memoize propagated positions
  const activeSatellites = useMemo(() => {
    if (mode !== 'satellites') return [];
    return satellites
      .map(sat => propagateSatellite(sat, time))
      .filter((sat): sat is SatelliteData => sat !== null);
  }, [satellites, time, mode]);

  // Handle focused satellite (search result)
  useEffect(() => {
    if (focusedSatelliteId && globeEl.current) {
      const sat = activeSatellites.find(s => s.id === focusedSatelliteId);
      if (sat) {
        globeEl.current.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 1.5 }, 1000);
        setHoveredSat(sat);
        if (onHoverSatellite) onHoverSatellite(sat);
      }
    }
  }, [focusedSatelliteId, activeSatellites, onHoverSatellite]);

  // Handle selected launch
  useEffect(() => {
    if (selectedLaunchId && globeEl.current && mode === 'launches') {
      const launch = launches.find(l => l.id === selectedLaunchId);
      if (launch) {
        globeEl.current.pointOfView({ 
          lat: parseFloat(launch.pad.latitude), 
          lng: parseFloat(launch.pad.longitude), 
          altitude: 1.5 
        }, 1000);
      }
    }
  }, [selectedLaunchId, launches, mode]);

  // Find the up-to-date position of the hovered satellite
  const activeHoveredSat = useMemo(() => {
    if (!hoveredSat) return null;
    return activeSatellites.find(s => s.id === hoveredSat.id) || hoveredSat;
  }, [hoveredSat, activeSatellites]);

  // Sync hovered satellite state with parent
  useEffect(() => {
    if (onHoverSatellite && mode === 'satellites') {
      onHoverSatellite(activeHoveredSat);
    }
  }, [activeHoveredSat, onHoverSatellite, mode]);

  // Trajectory for hovered satellite
  const trajectoryData = useMemo(() => {
    if (!hoveredSat || mode !== 'satellites') return [];
    const path = getTrajectory(hoveredSat, 180, 2); // 3 hours, 2 min steps
    return [{ path, color: 'rgba(0, 255, 255, 0.6)' }];
  }, [hoveredSat, mode]);

  // Reusable Three.js assets
  const satGeometry = useMemo(() => new THREE.SphereGeometry(SAT_SIZE, 8, 8), []);
  const satGeometrySmall = useMemo(() => new THREE.SphereGeometry(SAT_SIZE * 0.7, 4, 4), []);
  const satGeometryHover = useMemo(() => new THREE.SphereGeometry(SAT_SIZE * 2, 8, 8), []);
  
  const materials = useMemo(() => ({
    station: new THREE.MeshLambertMaterial({ color: '#10b981' }),
    satellite: new THREE.MeshLambertMaterial({ color: '#a8a29e' }),
    starlink: new THREE.MeshLambertMaterial({ color: '#60a5fa' }),
    gps: new THREE.MeshLambertMaterial({ color: '#fbbf24' }),
    geo: new THREE.MeshLambertMaterial({ color: '#f87171' }),
    iss: new THREE.MeshLambertMaterial({ color: '#ff5f1f', emissive: '#ff5f1f', emissiveIntensity: 0.5 }),
    hover: new THREE.MeshLambertMaterial({ color: '#06b6d4', emissive: '#0891b2', emissiveIntensity: 1 })
  }), []);

  // --- 3D Model Generators ---

  // Reusable Geometries/Materials for Starlink to improve performance
  const starlinkBodyGeo = useMemo(() => new THREE.BoxGeometry(0.5, 0.05, 0.3), []);
  const starlinkPanelGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(0.02, 1.0, 0.3);
    g.translate(0, 0.5, 0); // Offset so pivot is at bottom
    return g;
  }, []);
  const starlinkBodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.4, metalness: 0.6 }), []);
  const starlinkPanelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#172554', roughness: 0.2, emissive: '#1e3a8a', emissiveIntensity: 0.2 }), []);

  const createStarlinkModel = () => {
    const group = new THREE.Group();
    const chassis = new THREE.Mesh(starlinkBodyGeo, starlinkBodyMat);
    const panel = new THREE.Mesh(starlinkPanelGeo, starlinkPanelMat);
    // Panel is already translated in geometry, just add it
    group.add(chassis);
    group.add(panel);
    return group;
  };

  const createDetailedISSModel = () => {
    const group = new THREE.Group();
    const moduleMat = new THREE.MeshLambertMaterial({ color: '#f3f4f6' }); // White/Grey modules
    const trussMat = new THREE.MeshLambertMaterial({ color: '#9ca3af' }); // Grey truss
    const solarMat = new THREE.MeshStandardMaterial({ 
      color: '#b45309', // Copper
      roughness: 0.4,
      metalness: 0.6,
      emissive: '#7c2d12',
      emissiveIntensity: 0.1
    });
    const radiatorMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });

    // --- Integrated Truss Structure (ITS) ---
    // Main Truss Spine (approx 100m long in real life, scaled here)
    const truss = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, 0.15), trussMat);
    group.add(truss);

    // --- Solar Arrays (8 Wings) ---
    // Each wing is large. 4 pairs on the truss ends.
    const solarWingGeo = new THREE.BoxGeometry(0.5, 2.5, 0.05);
    const solarPositions = [
      { x: -3.8, z: 0.5 }, { x: -3.8, z: -0.5 }, // Port Outer
      { x: -2.8, z: 0.5 }, { x: -2.8, z: -0.5 }, // Port Inner
      { x: 2.8, z: 0.5 },  { x: 2.8, z: -0.5 },  // Starboard Inner
      { x: 3.8, z: 0.5 },  { x: 3.8, z: -0.5 }   // Starboard Outer
    ];

    solarPositions.forEach(pos => {
      const wing = new THREE.Mesh(solarWingGeo, solarMat);
      wing.position.set(pos.x, 0, pos.z);
      // Rotate them to face sun (arbitrary here)
      wing.rotation.x = Math.PI / 4; 
      group.add(wing);
    });

    // --- Pressurized Modules ---
    
    // Zarya (FGB) - The first module
    const zarya = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 16), moduleMat);
    zarya.rotation.z = Math.PI / 2;
    zarya.position.set(0.5, -0.2, 0);
    group.add(zarya);

    // Unity (Node 1)
    const unity = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.6, 16), moduleMat);
    unity.rotation.z = Math.PI / 2;
    unity.position.set(0, -0.2, 0);
    group.add(unity);

    // Destiny (US Lab)
    const destiny = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 16), moduleMat);
    destiny.rotation.z = Math.PI / 2;
    destiny.position.set(-0.8, -0.2, 0);
    group.add(destiny);

    // Harmony (Node 2)
    const harmony = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 16), moduleMat);
    harmony.rotation.z = Math.PI / 2;
    harmony.position.set(-1.6, -0.2, 0);
    group.add(harmony);

    // Columbus (ESA Lab) - Stick out to side of Harmony
    const columbus = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 16), moduleMat);
    columbus.rotation.x = Math.PI / 2;
    columbus.position.set(-1.6, -0.2, 0.5);
    group.add(columbus);

    // Kibo (JEM) - Stick out other side of Harmony
    const kibo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 16), moduleMat);
    kibo.rotation.x = Math.PI / 2;
    kibo.position.set(-1.6, -0.2, -0.6);
    group.add(kibo);

    // Zvezda (Service Module) - Behind Zarya
    const zvezda = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.0, 16), moduleMat);
    zvezda.rotation.z = Math.PI / 2;
    zvezda.position.set(1.5, -0.2, 0);
    group.add(zvezda);

    // --- Radiators ---
    const radiatorGeo = new THREE.BoxGeometry(0.6, 1.5, 0.05);
    const rad1 = new THREE.Mesh(radiatorGeo, radiatorMat);
    rad1.position.set(-0.5, 0, 0.6);
    rad1.rotation.x = -Math.PI / 3;
    group.add(rad1);

    const rad2 = new THREE.Mesh(radiatorGeo, radiatorMat);
    rad2.position.set(-1.0, 0, 0.6);
    rad2.rotation.x = -Math.PI / 3;
    group.add(rad2);

    // Scale entire station
    group.scale.set(0.8, 0.8, 0.8);
    return group;
  };

  // Custom object for satellites
  const getSatObject = (d: object) => {
    const sat = d as SatelliteData;
    const isHovered = hoveredSat?.id === sat.id || focusedSatelliteId === sat.id;
    
    // Strict check for ISS (NORAD ID 25544)
    // TLE Line 1, columns 2-7 contains the catalog number
    const noradId = sat.tle1 ? sat.tle1.substring(2, 7).trim() : '';
    const isISS = noradId === '25544'; 
    
    const isStarlink = sat.type === 'starlink';

    // 1. ISS
    if (isISS) {
      const model = createDetailedISSModel();
      if (isHovered) {
        model.scale.multiplyScalar(1.5);
      }
      return model;
    }

    // 2. Starlink - ALWAYS use the model now
    if (isStarlink) {
      const model = createStarlinkModel();
      // Scale up slightly if hovered
      if (isHovered) {
        model.scale.multiplyScalar(2.5);
        // Highlight material (optional, but cloning materials is expensive per frame)
        // Let's just rely on scale for hover feedback for now to save perf
      }
      return model;
    }
    
    // 3. Others: Standard Geometry
    let geometry = isHovered ? satGeometryHover : satGeometry;
    let material;

    if (isHovered) {
      material = materials.hover;
    } else {
      switch (sat.type) {
        case 'station': material = materials.station; break;
        case 'gps': material = materials.gps; break;
        case 'geo': material = materials.geo; break;
        default: material = materials.satellite;
      }
    }
    
    return new THREE.Mesh(geometry, material);
  };

  // Launch HTML Elements
  const getLaunchLabel = (d: object) => {
    const launch = d as Launch;
    const el = document.createElement('div');
    el.className = 'flex flex-col items-center gap-1 cursor-pointer';
    el.innerHTML = `
      <div class="w-2 h-8 bg-gradient-to-t from-rose-500 to-transparent opacity-80"></div>
      <div class="w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
      <div class="bg-black/80 text-white text-[10px] px-2 py-1 rounded border border-rose-500/30 whitespace-nowrap backdrop-blur-sm">
        ${launch.name}
      </div>
    `;
    return el;
  };

  // Constellation Lines
  const constellationPaths = useMemo(() => {
    if (!showConstellationLines || mode !== 'satellites') return [];
    
    const groups: Record<string, SatelliteData[]> = {};
    activeSatellites.forEach(sat => {
      if (sat.type === 'starlink' || sat.type === 'gps') {
        if (!groups[sat.type]) groups[sat.type] = [];
        groups[sat.type].push(sat);
      }
    });

    const paths: any[] = [];
    Object.entries(groups).forEach(([type, sats]) => {
      // Draw a "web" by connecting each satellite to its nearest 2 neighbors
      // This is a simplified visualization of the constellation mesh
      for (let i = 0; i < sats.length; i++) {
        const s1 = sats[i];
        const neighbors = sats
          .filter(s => s.id !== s1.id)
          .map(s => ({ 
            sat: s, 
            dist: Math.sqrt(Math.pow(s.lat - s1.lat, 2) + Math.pow(s.lng - s1.lng, 2)) 
          }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 2);

        neighbors.forEach(n => {
          paths.push({
            coords: [[s1.lat, s1.lng, s1.alt], [n.sat.lat, n.sat.lng, n.sat.alt]],
            color: type === 'starlink' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'
          });
        });
      }
    });
    return paths;
  }, [activeSatellites, showConstellationLines, mode]);

  // Handle Sky View Camera
  useEffect(() => {
    if (isSkyView && userLocation && globeEl.current) {
      // Move camera to user location, looking up
      globeEl.current.pointOfView({
        lat: userLocation.lat,
        lng: userLocation.lng,
        altitude: 0.5 // Very close to surface
      }, 1000);
    }
  }, [isSkyView, userLocation]);

  return (
    <div className="w-full h-full bg-black">
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#ffffff"
        atmosphereAltitude={0.15}
        
        // --- MINIMALISTIC MAP ---
        polygonsData={landPolygons}
        polygonCapColor={() => '#333333'} // Dark gray land
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => '#555555'} // Slightly lighter stroke
        polygonAltitude={0.01}
        
        // --- PATHS (Terminator, Constellations, Trajectories) ---
        pathsData={[
          ...terminatorData, 
          ...constellationPaths,
          ...(mode === 'satellites' ? trajectoryData : [])
        ]}
        pathPoints={d => d.path || d.coords}
        pathPointLat={d => d.lat || d[0]}
        pathPointLng={d => d.lng || d[1]}
        pathPointAlt={d => (d.alt !== undefined ? d.alt / EARTH_RADIUS_KM : (d[2] || 0))}
        pathColor={d => d.color || 'rgba(255, 255, 255, 0.4)'}
        pathStroke={d => d.color ? 1 : 2}
        pathDashLength={d => d.color ? 0 : 0.05}
        pathDashGap={d => d.color ? 0 : 0.02}
        pathDashAnimateTime={d => d.color ? 0 : 5000}
        
        // --- SATELLITE MODE ---
        objectsData={mode === 'satellites' ? activeSatellites : []}
        objectLat="lat"
        objectLng="lng"
        objectAltitude={(d) => (d as SatelliteData).alt / EARTH_RADIUS_KM}
        objectThreeObject={getSatObject}
        objectLabel="name"
        onObjectHover={(obj) => {
          if (mode !== 'satellites') return;
          const sat = obj as SatelliteData | null;
          if (sat?.id !== hoveredSat?.id) {
            setHoveredSat(sat);
          }
          document.body.style.cursor = sat ? 'pointer' : 'default';
        }}

        // Rings (Selection Highlight)
        ringsData={mode === 'satellites' && activeHoveredSat ? [activeHoveredSat] : []}
        ringLat="lat"
        ringLng="lng"
        ringAlt={(d) => (d as SatelliteData).alt / EARTH_RADIUS_KM}
        ringColor={() => '#06b6d4'}
        ringMaxRadius={5}
        ringPropagationSpeed={5}
        ringRepeatPeriod={800}

        // --- LAUNCH MODE ---
        htmlElementsData={mode === 'launches' ? launches : []}
        htmlLat={(d) => parseFloat((d as Launch).pad.latitude)}
        htmlLng={(d) => parseFloat((d as Launch).pad.longitude)}
        htmlElement={getLaunchLabel}
        htmlAltitude={0.1}

        // Config
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
};

export default GlobeView;
