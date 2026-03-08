import { useState, useEffect, useMemo, useRef } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import * as satellite from 'satellite.js';
import * as THREE from 'three';

// Types
export interface SatelliteData {
  id: string;
  name: string;
  tle1: string;
  tle2: string;
  satrec: any; // satellite.SatRec
  lat: number;
  lng: number;
  alt: number; // in km
  velocity: number; // in km/s
  type: 'station' | 'satellite' | 'debris' | 'starlink' | 'geo' | 'gps';
  people?: number; // Number of people on board
}

// Service to fetch TLE data
const CELESTRAK_BASE_URL = 'https://celestrak.org/NORAD/elements/gp.php';

export const fetchPeopleInSpace = async (): Promise<Record<string, number>> => {
  try {
    // Try to fetch from a CORS-friendly proxy or API
    // Since OpenNotify is HTTP-only, we might need a fallback or a different source.
    // For this demo, we'll try a known reliable JSON endpoint if available, 
    // otherwise we'll return current known values (as of late 2024/early 2025).
    
    // Fallback data (approximate)
    const people: Record<string, number> = {
      'ISS (ZARYA)': 7,
      'TIANGONG': 3
    };

    try {
        // Attempt to fetch real data if possible (this might fail due to CORS/Mixed Content)
        // Using a proxy service if available would be better.
        // For now, we return the fallback to ensure stability in the preview environment.
        return people;
    } catch (e) {
        return people;
    }
  } catch (error) {
    console.error('Error fetching people in space:', error);
    return {};
  }
};

export const fetchSatellites = async (group: string = 'stations', type: SatelliteData['type'] = 'satellite'): Promise<SatelliteData[]> => {
  try {
    // Using a CORS proxy might be necessary in some environments, but CelesTrak usually supports CORS.
    // If it fails, we might need a fallback or a proxy.
    const response = await fetch(`${CELESTRAK_BASE_URL}?GROUP=${group}&FORMAT=tle`);
    if (!response.ok) throw new Error('Failed to fetch satellite data');
    
    const text = await response.text();
    const lines = text.split('\n');
    const sats: SatelliteData[] = [];

    for (let i = 0; i < lines.length; i += 3) {
      const name = lines[i]?.trim();
      const tle1 = lines[i + 1]?.trim();
      const tle2 = lines[i + 2]?.trim();

      if (name && tle1 && tle2) {
        try {
          const satrec = satellite.twoline2satrec(tle1, tle2);
          sats.push({
            id: name.replace(/\s+/g, '-'),
            name,
            tle1,
            tle2,
            satrec,
            lat: 0,
            lng: 0,
            alt: 0,
            velocity: 0,
            type: type
          });
        } catch (e) {
          console.warn(`Failed to parse satellite ${name}`, e);
        }
      }
    }
    return sats;
  } catch (error) {
    console.error('Error fetching satellites:', error);
    return [];
  }
};

export const propagateSatellite = (sat: SatelliteData, date: Date = new Date()): SatelliteData | null => {
  const positionAndVelocity = satellite.propagate(sat.satrec, date);
  const positionEci = positionAndVelocity.position as any; // satellite.EciVec3<number>
  const velocityEci = positionAndVelocity.velocity as any; // satellite.EciVec3<number>

  if (!positionEci || !velocityEci) return null;

  const gmst = satellite.gstime(date);
  const positionGd = satellite.eciToGeodetic(positionEci, gmst);

  // Velocity magnitude in km/s
  const velocity = Math.sqrt(
    velocityEci.x * velocityEci.x + 
    velocityEci.y * velocityEci.y + 
    velocityEci.z * velocityEci.z
  );

  return {
    ...sat,
    lat: satellite.degreesLat(positionGd.latitude),
    lng: satellite.degreesLong(positionGd.longitude),
    alt: positionGd.height, // height in km
    velocity
  };
};

export const getTrajectory = (sat: SatelliteData, durationMinutes: number = 180, stepMinutes: number = 1) => {
  const path = [];
  const now = new Date();
  
  for (let i = 0; i <= durationMinutes; i += stepMinutes) {
    const futureDate = new Date(now.getTime() + i * 60 * 1000);
    const posVel = satellite.propagate(sat.satrec, futureDate);
    const positionEci = posVel.position as any; // satellite.EciVec3<number>
    
    if (positionEci) {
      const gmst = satellite.gstime(futureDate);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      
      path.push({
        lat: satellite.degreesLat(positionGd.latitude),
        lng: satellite.degreesLong(positionGd.longitude),
        alt: positionGd.height // Return in km, same as propagateSatellite
      });
    }
  }
  return path;
};
