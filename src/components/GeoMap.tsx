import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export type GeoCountry = {
  country: string
  countryCode: string
  lat: number
  lng: number
  count: number
  critical: number
  high: number
  medium: number
  low: number
  latestSeen: string
  sampleIPs: string[]
}

interface GeoMapProps {
  countries: GeoCountry[]
  onCountryClick?: (country: GeoCountry) => void
  selectedCode?: string | null
}

// Severity → marker fill color
function markerColor(c: GeoCountry): string {
  if (c.critical > 0) return '#ef4444'
  if (c.high > 0) return '#f97316'
  if (c.medium > 0) return '#eab308'
  return '#3b82f6'
}

// Count → radius px (log scale, clamp 7–34)
function markerRadius(count: number, max: number): number {
  if (max === 0) return 7
  const ratio = Math.log(count + 1) / Math.log(max + 1)
  return Math.max(7, Math.round(ratio * 34))
}

// Recenter map when countries list changes
function FitBounds({ countries }: { countries: GeoCountry[] }) {
  const map = useMap()
  useEffect(() => {
    if (countries.length === 0) return
    // Don't auto-fit — keep the default world view so user controls zoom
  }, [countries, map])
  return null
}

export default function GeoMap({ countries, onCountryClick, selectedCode }: GeoMapProps) {
  const max = countries.reduce((m, c) => Math.max(m, c.count), 0)

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      minZoom={2}
      maxZoom={10}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0b1220' }}
      className="rounded-lg"
      // Prevent leaflet from showing attribution in a distracting colour
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <FitBounds countries={countries} />

      {countries.map((c) => {
        const radius = markerRadius(c.count, max)
        const color = markerColor(c)
        const isSelected = selectedCode === c.countryCode

        return (
          <CircleMarker
            key={c.countryCode}
            center={[c.lat, c.lng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              fillOpacity: isSelected ? 0.95 : 0.75,
              color: isSelected ? '#ffffff' : color,
              weight: isSelected ? 2 : 1,
            }}
            eventHandlers={{
              click: () => onCountryClick?.(c),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -radius]}
              opacity={1}
              className="geo-tooltip"
            >
              <div className="text-xs">
                <p className="font-bold">{c.country}</p>
                <p>{c.count} IP IOCs</p>
                {c.critical > 0 && <p className="text-red-400">Critical: {c.critical}</p>}
                {c.high > 0 && <p className="text-orange-400">High: {c.high}</p>}
                {c.medium > 0 && <p className="text-yellow-400">Medium: {c.medium}</p>}
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
