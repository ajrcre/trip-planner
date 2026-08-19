import type { MetadataRoute } from "next"

/**
 * Makes the app installable to the home screen.
 *
 * Worth having beyond the launcher icon: an installed PWA gets more durable
 * storage than a regular Safari tab, which matters when the offline caches need
 * to survive from packing day to the flight.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מתכנן טיולים",
    short_name: "טיולים",
    description: "מתכנן טיולים משפחתי — זמין גם ללא חיבור לאינטרנט",
    lang: "he",
    dir: "rtl",
    // The trip list, not "/": offline that landing page is the least useful
    // screen, and it is the one page rendered on the server.
    start_url: "/trips",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
