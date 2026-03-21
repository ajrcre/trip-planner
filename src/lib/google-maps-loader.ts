import { setOptions, importLibrary } from "@googlemaps/js-api-loader"

let optionsSet = false

function ensureOptions(): void {
  if (optionsSet) return
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY!,
    v: "weekly",
    libraries: ["places", "marker"],
  })
  optionsSet = true
}

export async function loadMapsLibrary(): Promise<google.maps.MapsLibrary> {
  ensureOptions()
  return importLibrary("maps")
}

export async function loadMarkerLibrary(): Promise<google.maps.MarkerLibrary> {
  ensureOptions()
  return importLibrary("marker")
}
