"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { PlaceDoc } from "@/lib/types";

export interface MapPin extends PlaceDoc {
  id: string;
}

export interface HomePin {
  uid: string;
  name: string;
  lat: number;
  lng: number;
}

interface MemoryMapProps {
  pins: MapPin[];
  homes: HomePin[];
  /** Fires on long-press (Leaflet's contextmenu, which mobile maps to a long tap). */
  onLongPress: (lat: number, lng: number) => void;
  onPinTap: (pin: MapPin) => void;
  /** When set, the map pans here (search result / new place). */
  focus: { lat: number; lng: number } | null;
}

/** Emoji markers avoid Leaflet's default marker-image path problem under bundlers. */
function emojiIcon(emoji: string, label: string) {
  return L.divIcon({
    html: `<span role="img" aria-label="${label}" style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))">${emoji}</span>`,
    className: "tincan-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 28],
  });
}

function Events({ onLongPress }: { onLongPress: (lat: number, lng: number) => void }) {
  useMapEvents({
    contextmenu(e) {
      e.originalEvent.preventDefault();
      onLongPress(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitOnce({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    const [only] = points;
    if (points.length === 1 && only !== undefined) {
      map.setView(only, 10);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    // Only on first load / when the set of pins changes meaningfully.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function Focus({ focus }: { focus: MemoryMapProps["focus"] }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 11), { duration: 0.8 });
  }, [focus, map]);
  return null;
}

export default function MemoryMap({ pins, homes, onLongPress, onPinTap, focus }: MemoryMapProps) {
  const points = useMemo<Array<[number, number]>>(() => [...homes.map((h) => [h.lat, h.lng] as [number, number]), ...pins.map((p) => [p.lat, p.lng] as [number, number])], [homes, pins]);
  const icons = useMemo(() => ({ been: emojiIcon("🟢", "Been"), want: emojiIcon("🟣", "Want to go"), home: emojiIcon("🏠", "Home") }), []);

  return (
    <MapContainer center={[20, 78]} zoom={4} className="h-full w-full rounded-[20px]" scrollWheelZoom attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Events onLongPress={onLongPress} />
      <FitOnce points={points} />
      <Focus focus={focus} />
      {homes.map((h) => (
        <Marker key={`home-${h.uid}`} position={[h.lat, h.lng]} icon={icons.home} title={`${h.name}'s home`} />
      ))}
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icons[p.kind]} title={p.name} eventHandlers={{ click: () => onPinTap(p) }} />
      ))}
    </MapContainer>
  );
}
