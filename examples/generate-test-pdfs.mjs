import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { writeFileSync } from "fs"

async function createPdf(filename, drawFn) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([595, 842]) // A4
  await drawFn(page, font, boldFont)
  const bytes = await doc.save()
  writeFileSync(`examples/${filename}`, bytes)
  console.log(`Created examples/${filename}`)
}

function drawText(page, font, text, x, y, size = 11, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color })
}

// PDF 1: Flight confirmation with connection
await createPdf("test-flights.pdf", async (page, font, bold) => {
  let y = 780

  drawText(page, bold, "FLIGHT BOOKING CONFIRMATION", 50, y, 18, rgb(0.1, 0.1, 0.5))
  y -= 30
  drawText(page, font, "Booking Reference: ABC123", 50, y, 12)
  y -= 15
  drawText(page, font, "Passenger: Shahar Barak", 50, y, 12)
  y -= 30

  drawText(page, bold, "OUTBOUND FLIGHTS", 50, y, 14, rgb(0.2, 0.2, 0.6))
  y -= 25

  drawText(page, bold, "Flight 1: LY315", 50, y, 12)
  y -= 18
  drawText(page, font, "Date: August 10, 2026", 70, y)
  y -= 15
  drawText(page, font, "Departure: TLV (Ben Gurion) at 06:30", 70, y)
  y -= 15
  drawText(page, font, "Arrival: VIE (Vienna) at 09:45", 70, y)
  y -= 25

  drawText(page, bold, "Flight 2: OS201", 50, y, 12)
  y -= 18
  drawText(page, font, "Date: August 10, 2026", 70, y)
  y -= 15
  drawText(page, font, "Departure: VIE (Vienna) at 11:30", 70, y)
  y -= 15
  drawText(page, font, "Arrival: SZG (Salzburg) at 12:15", 70, y)
  y -= 35

  drawText(page, bold, "RETURN FLIGHT", 50, y, 14, rgb(0.2, 0.2, 0.6))
  y -= 25

  drawText(page, bold, "Flight 3: LY316", 50, y, 12)
  y -= 18
  drawText(page, font, "Date: August 20, 2026", 70, y)
  y -= 15
  drawText(page, font, "Departure: SZG (Salzburg) at 14:00", 70, y)
  y -= 15
  drawText(page, font, "Arrival: TLV (Ben Gurion) at 19:30", 70, y)
  y -= 35

  drawText(page, font, "Total passengers: 4 (2 adults, 2 children)", 50, y, 10, rgb(0.4, 0.4, 0.4))
})

// PDF 2: Hotel booking
await createPdf("test-hotel.pdf", async (page, font, bold) => {
  let y = 780

  drawText(page, bold, "HOTEL RESERVATION CONFIRMATION", 50, y, 18, rgb(0.1, 0.4, 0.1))
  y -= 35

  drawText(page, bold, "Hotel Sacher Salzburg", 50, y, 14)
  y -= 20
  drawText(page, font, "Address: Schwarzstrasse 5-7, 5020 Salzburg, Austria", 50, y)
  y -= 15
  drawText(page, font, "Phone: +43 662 88977", 50, y)
  y -= 15
  drawText(page, font, "Booking Reference: HTL-98765", 50, y)
  y -= 30

  drawText(page, bold, "Reservation Details:", 50, y, 12)
  y -= 20
  drawText(page, font, "Check-in:  August 10, 2026, 15:00", 70, y)
  y -= 15
  drawText(page, font, "Check-out: August 15, 2026, 11:00", 70, y)
  y -= 15
  drawText(page, font, "Room: Family Suite (2 adjoining rooms)", 70, y)
  y -= 15
  drawText(page, font, "Guests: 2 adults, 2 children", 70, y)
  y -= 40

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
  y -= 25

  drawText(page, bold, "Pension Edelweiss", 50, y, 14)
  y -= 20
  drawText(page, font, "Address: Getreidegasse 42, 5020 Salzburg, Austria", 50, y)
  y -= 15
  drawText(page, font, "Phone: +43 662 54321", 50, y)
  y -= 15
  drawText(page, font, "Booking Reference: PEN-44321", 50, y)
  y -= 30

  drawText(page, bold, "Reservation Details:", 50, y, 12)
  y -= 20
  drawText(page, font, "Check-in:  August 15, 2026, 14:00", 70, y)
  y -= 15
  drawText(page, font, "Check-out: August 20, 2026, 10:00", 70, y)
  y -= 15
  drawText(page, font, "Room: Double Room + Extra Bed", 70, y)
  y -= 15
  drawText(page, font, "Guests: 2 adults, 2 children", 70, y)
})

// PDF 3: Car rental
await createPdf("test-car-rental.pdf", async (page, font, bold) => {
  let y = 780

  drawText(page, bold, "CAR RENTAL CONFIRMATION", 50, y, 18, rgb(0.5, 0.2, 0.1))
  y -= 30
  drawText(page, font, "Confirmation Number: CR-2026-7890", 50, y, 12)
  y -= 30

  drawText(page, bold, "Rental Details", 50, y, 14)
  y -= 22
  drawText(page, font, "Company: Europcar", 70, y)
  y -= 15
  drawText(page, font, "Vehicle: VW Touran or similar (Family MPV)", 70, y)
  y -= 25

  drawText(page, bold, "Pick-up:", 70, y, 12)
  y -= 18
  drawText(page, font, "Location: Salzburg Airport (SZG)", 90, y)
  y -= 15
  drawText(page, font, "Date/Time: August 10, 2026 at 13:00", 90, y)
  y -= 25

  drawText(page, bold, "Return:", 70, y, 12)
  y -= 18
  drawText(page, font, "Location: Salzburg Airport (SZG)", 90, y)
  y -= 15
  drawText(page, font, "Date/Time: August 20, 2026 at 12:00", 90, y)
  y -= 30

  drawText(page, bold, "Additional Details:", 50, y, 12)
  y -= 18
  drawText(page, font, "- Full insurance coverage included", 70, y)
  y -= 15
  drawText(page, font, "- GPS navigation system", 70, y)
  y -= 15
  drawText(page, font, "- 2 child car seats (ages 3 and 7)", 70, y)
  y -= 15
  drawText(page, font, "- Unlimited mileage", 70, y)
})

// PDF 4: Combined booking (flight + hotel + car in one document)
await createPdf("test-combined-booking.pdf", async (page, font, bold) => {
  let y = 780

  drawText(page, bold, "TRAVEL PACKAGE - BOOKING SUMMARY", 50, y, 16, rgb(0.1, 0.1, 0.5))
  y -= 20
  drawText(page, font, "Destination: Salzburg, Austria", 50, y, 11)
  y -= 15
  drawText(page, font, "Travel Dates: August 10 - August 20, 2026", 50, y, 11)
  y -= 25

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.3, 0.3, 0.7) })
  y -= 20

  drawText(page, bold, "FLIGHTS", 50, y, 13, rgb(0.2, 0.2, 0.6))
  y -= 20
  drawText(page, font, "LY315 | TLV -> VIE | Aug 10, 2026 | Dep 06:30 Arr 09:45", 60, y, 10)
  y -= 14
  drawText(page, font, "OS201 | VIE -> SZG | Aug 10, 2026 | Dep 11:30 Arr 12:15", 60, y, 10)
  y -= 14
  drawText(page, font, "LY316 | SZG -> TLV | Aug 20, 2026 | Dep 14:00 Arr 19:30", 60, y, 10)
  y -= 25

  drawText(page, bold, "ACCOMMODATION", 50, y, 13, rgb(0.1, 0.4, 0.1))
  y -= 20
  drawText(page, font, "Hotel Sacher Salzburg", 60, y, 10)
  y -= 14
  drawText(page, font, "Schwarzstrasse 5-7, 5020 Salzburg | Ref: HTL-98765", 60, y, 10)
  y -= 14
  drawText(page, font, "Check-in: Aug 10, 15:00 | Check-out: Aug 15, 11:00", 60, y, 10)
  y -= 20
  drawText(page, font, "Pension Edelweiss", 60, y, 10)
  y -= 14
  drawText(page, font, "Getreidegasse 42, 5020 Salzburg | Ref: PEN-44321", 60, y, 10)
  y -= 14
  drawText(page, font, "Check-in: Aug 15, 14:00 | Check-out: Aug 20, 10:00", 60, y, 10)
  y -= 25

  drawText(page, bold, "CAR RENTAL", 50, y, 13, rgb(0.5, 0.2, 0.1))
  y -= 20
  drawText(page, font, "Europcar | VW Touran (Family MPV)", 60, y, 10)
  y -= 14
  drawText(page, font, "Pick-up: Salzburg Airport (SZG) | Aug 10, 13:00", 60, y, 10)
  y -= 14
  drawText(page, font, "Return: Salzburg Airport (SZG) | Aug 20, 12:00", 60, y, 10)
  y -= 14
  drawText(page, font, "Includes: Full insurance, GPS, 2 child seats, unlimited mileage", 60, y, 10)
})

console.log("\nAll test PDFs created successfully!")
