import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Packer,
} from "docx"

import { formatUiDateTime } from "@/lib/format-time"

import { parseDayHours, DAY_NAMES_EN, DAY_NAMES_HE, formatAmPmTimesInText } from "@/lib/time-parsing"

// A4 page: 11906 DXA wide, 1440 DXA margins each side = 9026 DXA content width
const CONTENT_WIDTH = 9026

interface PlaceInfo {
  name: string
  address?: string | null
  phone?: string | null
  website?: string | null
  googlePlaceId?: string | null
  openingHours?: unknown
}

const typeLabels: Record<string, string> = {
  attraction: "אטרקציה",
  meal: "ארוחה",
  travel: "נסיעה",
  rest: "מנוחה",
  custom: "אחר",
  grocery: "קניות",
  flight_departure: "המראה",
  flight_arrival: "נחיתה",
  car_pickup: "איסוף רכב",
  car_return: "החזרת רכב",
  lodging: "לינה",
  free_time: "זמן חופשי",
}

function getMealLabel(timeStart: string | null | undefined): string {
  if (!timeStart) return "ארוחה"
  const hour = parseInt(timeStart.split(":")[0], 10)
  if (isNaN(hour)) return "ארוחה"
  if (hour < 11) return "ארוחת בוקר"
  if (hour < 16) return "ארוחת צהריים"
  return "ארוחת ערב"
}

function getOpeningHoursForDate(openingHours: unknown, dateStr: string): string | null {
  const allHours = parseDayHours(openingHours)
  if (allHours.length === 0) return null
  const targetDate = new Date(dateStr)
  const dayIndex = targetDate.getUTCDay()
  const dayNameEn = DAY_NAMES_EN[dayIndex]
  const dayNameHe = DAY_NAMES_HE[dayNameEn]
  const today = allHours.find((h) => h.dayName === dayNameEn || h.dayName === dayNameHe)
  if (!today) return null
  const dayLabel = DAY_NAMES_HE[today.dayName] ?? today.dayName
  return `${dayLabel}: ${today.hours ? formatAmPmTimesInText(today.hours) : "סגור"}`
}

interface TripData {
  name: string
  destination: string
  startDate: string
  endDate: string
  accommodation: Array<{
    name?: string
    address?: string
    checkIn?: string
    checkOut?: string
    contact?: string
    bookingReference?: string
  }> | null
  flights: Array<{
    flightNumber?: string | null
    departureAirport?: string | null
    departureTime?: string | null
    arrivalAirport?: string | null
    arrivalTime?: string | null
  }> | null
  carRental: Array<{
    company?: string | null
    pickupLocation?: string | null
    pickupTime?: string | null
    returnLocation?: string | null
    returnTime?: string | null
    additionalDetails?: string | null
  }> | null
  attractions: Array<{
    name: string
    address?: string | null
    phone?: string | null
    website?: string | null
    ratingGoogle?: number | null
    status: string
    bookingRequired: boolean
    specialNotes?: string | null
  }>
  restaurants: Array<{
    name: string
    cuisineType?: string | null
    address?: string | null
    phone?: string | null
    ratingGoogle?: number | null
    kidFriendly: boolean
    status: string
  }>
  dayPlans: Array<{
    date: string
    dayType: string
    activities: Array<{
      sortOrder: number
      timeStart?: string | null
      timeEnd?: string | null
      type: string
      notes?: string | null
      travelTimeToNextMinutes?: number | null
      travelLeg?: {
        driveMinutes?: number | null
        resolvedOrigin?: { label?: string; lat?: number; lng?: number } | null
        resolvedDestination?: { label?: string; lat?: number; lng?: number } | null
      } | null
      restAccommodationIndex?: number | null
      attraction?: PlaceInfo | null
      restaurant?: PlaceInfo | null
      groceryStore?: PlaceInfo | null
    }>
  }>
  packingItems: Array<{
    category: string
    item: string
    checked: boolean
    forMember?: string | null
  }>
  shoppingItems: Array<{
    category: string
    item: string
    checked: boolean
  }>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL")
}

function createInfoParagraph(label: string, value: string): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: `${label}: `, bold: true, rightToLeft: true }),
      new TextRun({ text: value, rightToLeft: true }),
    ],
  })
}

function createHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    heading: level,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text, bold: true, rightToLeft: true })],
  })
}

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "999999" } as const
const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
} as const

const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 }

function createTableCell(text: string, widthDxa: number, isHeader = false): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: widthDxa, type: WidthType.DXA },
    margins: cellMargins,
    shading: isHeader ? { fill: "E8E8E8", type: ShadingType.CLEAR } : undefined,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text,
            bold: isHeader,
            rightToLeft: true,
            size: isHeader ? 20 : 18,
            font: "Arial",
          }),
        ],
      }),
    ],
  })
}

function buildFlightSection(flights: TripData["flights"]): Paragraph[] {
  if (!flights || flights.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("טיסות", HeadingLevel.HEADING_2)]

  for (const flight of flights) {
    if (!flight.flightNumber && !flight.departureAirport) continue

    if (flight.flightNumber) {
      paragraphs.push(createInfoParagraph("מספר טיסה", flight.flightNumber))
    }
    if (flight.departureAirport) {
      paragraphs.push(
        createInfoParagraph(
          "יציאה",
          `${flight.departureAirport}${flight.departureTime ? ` - ${formatUiDateTime(flight.departureTime)}` : ""}`
        )
      )
    }
    if (flight.arrivalAirport) {
      paragraphs.push(
        createInfoParagraph(
          "נחיתה",
          `${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatUiDateTime(flight.arrivalTime)}` : ""}`
        )
      )
    }
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}

function buildAccommodationSection(accommodations: TripData["accommodation"]): Paragraph[] {
  const accs = (accommodations ?? []).filter((a) => a.name || a.address)
  if (accs.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("לינה", HeadingLevel.HEADING_2)]

  for (const acc of accs) {
    if (accs.length > 1 && acc.name) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: acc.name, bold: true, size: 22 })],
      }))
    }
    if (acc.name && accs.length === 1) paragraphs.push(createInfoParagraph("שם", acc.name))
    if (acc.address) paragraphs.push(createInfoParagraph("כתובת", acc.address))
    if (acc.checkIn) paragraphs.push(createInfoParagraph("צ'ק-אין", formatUiDateTime(acc.checkIn)))
    if (acc.checkOut) paragraphs.push(createInfoParagraph("צ'ק-אאוט", formatUiDateTime(acc.checkOut)))
    if (acc.contact) paragraphs.push(createInfoParagraph("פרטי קשר", acc.contact))
    if (acc.bookingReference) paragraphs.push(createInfoParagraph("מספר הזמנה", acc.bookingReference))
    if (accs.length > 1) paragraphs.push(new Paragraph({ text: "" }))
  }

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

function buildCarRentalSection(carRentals: TripData["carRental"]): Paragraph[] {
  if (!carRentals || carRentals.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("השכרת רכב", HeadingLevel.HEADING_2)]

  for (const car of carRentals) {
    if (!car.company && !car.pickupLocation) continue

    if (car.company) paragraphs.push(createInfoParagraph("חברה", car.company))
    if (car.pickupLocation) paragraphs.push(createInfoParagraph("מיקום איסוף", car.pickupLocation))
    if (car.pickupTime) paragraphs.push(createInfoParagraph("זמן איסוף", formatUiDateTime(car.pickupTime)))
    if (car.returnLocation) paragraphs.push(createInfoParagraph("מיקום החזרה", car.returnLocation))
    if (car.returnTime) paragraphs.push(createInfoParagraph("זמן החזרה", formatUiDateTime(car.returnTime)))
    if (car.additionalDetails) paragraphs.push(createInfoParagraph("פרטים נוספים", car.additionalDetails))
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}

function buildScheduleSection(
  dayPlans: TripData["dayPlans"],
  accommodations: TripData["accommodation"]
): Paragraph[] {
  if (!dayPlans || dayPlans.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading('לו"ז יומי', HeadingLevel.HEADING_2)]
  const accs = accommodations ?? []

  for (const day of dayPlans) {
    const dayTypeLabel =
      day.dayType === "travel" ? "יום נסיעה" : day.dayType === "rest" ? "יום מנוחה" : "יום טיול"

    paragraphs.push(
      createHeading(`${formatDate(day.date)} - ${dayTypeLabel}`, HeadingLevel.HEADING_3)
    )

    for (const activity of day.activities) {
      const place = activity.attraction ?? activity.restaurant ?? activity.groceryStore
      const label =
        activity.type === "meal"
          ? getMealLabel(activity.timeStart)
          : typeLabels[activity.type] ?? activity.type

      // Build activity name
      let name: string
      if (
        activity.type === "travel" &&
        activity.travelLeg?.resolvedOrigin &&
        activity.travelLeg?.resolvedDestination
      ) {
        name = `${activity.travelLeg.resolvedOrigin.label} → ${activity.travelLeg.resolvedDestination.label}`
      } else if (
        activity.type === "rest" &&
        activity.restAccommodationIndex != null &&
        accs[activity.restAccommodationIndex]?.name
      ) {
        name = `מנוחה — ${accs[activity.restAccommodationIndex]!.name}`
      } else {
        name = place?.name ?? activity.notes ?? label
      }

      // Time range
      const timePart = activity.timeStart
        ? `${activity.timeStart}${activity.timeEnd ? ` - ${activity.timeEnd}` : ""}`
        : ""

      // Main activity line: time + type label + name
      const runs: TextRun[] = []
      if (timePart) {
        runs.push(new TextRun({ text: timePart + "  ", bold: true, rightToLeft: true }))
      }
      runs.push(new TextRun({ text: `[${label}] `, rightToLeft: true, color: "666666", size: 18 }))
      runs.push(new TextRun({ text: name, bold: true, rightToLeft: true }))

      paragraphs.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 120 },
          children: runs,
        })
      )

      // Notes (for non-custom, non-travel types when name isn't already the notes)
      if (
        activity.notes &&
        activity.type !== "custom" &&
        activity.type !== "travel" &&
        activity.notes !== name
      ) {
        paragraphs.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            indent: { right: 400 },
            children: [
              new TextRun({ text: activity.notes, rightToLeft: true, italics: true, color: "555555", size: 18 }),
            ],
          })
        )
      }

      // Travel driving info
      if (activity.type === "travel" && activity.travelLeg?.driveMinutes != null) {
        paragraphs.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            indent: { right: 400 },
            children: [
              new TextRun({
                text: `🚗 ${activity.travelLeg.driveMinutes} דקות נסיעה משוערות`,
                rightToLeft: true,
                size: 18,
                color: "7C3AED",
              }),
            ],
          })
        )
      }

      // Navigation links for travel activities
      if (
        activity.type === "travel" &&
        activity.travelLeg?.resolvedOrigin?.lat != null &&
        activity.travelLeg?.resolvedDestination?.lat != null
      ) {
        const orig = activity.travelLeg.resolvedOrigin!
        const dest = activity.travelLeg.resolvedDestination!
        paragraphs.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            indent: { right: 400 },
            children: [
              new TextRun({
                text: `Google Maps: https://www.google.com/maps/dir/?api=1&origin=${orig.lat},${orig.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`,
                rightToLeft: false,
                size: 16,
                color: "2563EB",
              }),
            ],
          })
        )
      }

      // Place details (address, phone, website, opening hours)
      if (place) {
        const details: string[] = []
        if (place.address) details.push(`📍 ${place.address}`)
        if (place.phone) details.push(`📞 ${place.phone}`)
        if (place.website) {
          try {
            details.push(`🌐 ${new URL(place.website).hostname}  (${place.website})`)
          } catch {
            details.push(`🌐 ${place.website}`)
          }
        }
        if (place.openingHours) {
          const hours = getOpeningHoursForDate(place.openingHours, day.date)
          if (hours) details.push(`🕐 ${hours}`)
        }
        if (place.googlePlaceId) {
          details.push(
            `🗺️ https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`
          )
        }

        for (const detail of details) {
          paragraphs.push(
            new Paragraph({
              bidirectional: true,
              alignment: AlignmentType.RIGHT,
              indent: { right: 400 },
              children: [
                new TextRun({ text: detail, rightToLeft: true, size: 16, color: "555555" }),
              ],
            })
          )
        }
      }

      // Driving time to next activity
      if (
        activity.travelTimeToNextMinutes != null &&
        activity.travelTimeToNextMinutes > 0
      ) {
        paragraphs.push(
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: `🚗 ${activity.travelTimeToNextMinutes} דקות נסיעה`,
                rightToLeft: true,
                size: 16,
                color: "888888",
              }),
            ],
          })
        )
      }
    }
  }

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

function buildAttractionsSection(attractions: TripData["attractions"]): (Paragraph | Table)[] {
  if (!attractions || attractions.length === 0) return []
  const elements: (Paragraph | Table)[] = [createHeading("אטרקציות", HeadingLevel.HEADING_2)]

  // Column widths in DXA - must sum to CONTENT_WIDTH (9026)
  // name: 2200, address: 2400, phone: 1100, rating: 700, status: 900, notes: 1726
  const colWidths = [2200, 2400, 1100, 700, 900, 1726]

  const statusMap: Record<string, string> = {
    approved: "מאושר",
    maybe: "אולי",
    rejected: "נדחה",
  }

  const headerRow = new TableRow({
    children: [
      createTableCell("שם", colWidths[0], true),
      createTableCell("כתובת", colWidths[1], true),
      createTableCell("טלפון", colWidths[2], true),
      createTableCell("דירוג", colWidths[3], true),
      createTableCell("סטטוס", colWidths[4], true),
      createTableCell("הערות", colWidths[5], true),
    ],
  })

  const dataRows = attractions.map(
    (a) =>
      new TableRow({
        children: [
          createTableCell(a.name, colWidths[0]),
          createTableCell(a.address || "", colWidths[1]),
          createTableCell(a.phone || "", colWidths[2]),
          createTableCell(a.ratingGoogle ? String(a.ratingGoogle) : "", colWidths[3]),
          createTableCell(statusMap[a.status] || a.status, colWidths[4]),
          createTableCell(
            [
              a.bookingRequired ? "דורש הזמנה" : "",
              a.specialNotes || "",
            ]
              .filter(Boolean)
              .join(", "),
            colWidths[5]
          ),
        ],
      })
  )

  elements.push(
    new Table({
      visuallyRightToLeft: true,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: colWidths,
      rows: [headerRow, ...dataRows],
    })
  )

  elements.push(new Paragraph({ text: "" }))
  return elements
}

function buildRestaurantsSection(restaurants: TripData["restaurants"]): (Paragraph | Table)[] {
  if (!restaurants || restaurants.length === 0) return []
  const elements: (Paragraph | Table)[] = [createHeading("מסעדות", HeadingLevel.HEADING_2)]

  // Column widths in DXA - must sum to CONTENT_WIDTH (9026)
  // name: 1800, cuisine: 1200, address: 1900, phone: 1100, rating: 700, kidFriendly: 1100, status: 1226
  const colWidths = [1800, 1200, 1900, 1100, 700, 1100, 1226]

  const statusMap: Record<string, string> = {
    approved: "מאושר",
    maybe: "אולי",
    rejected: "נדחה",
  }

  const headerRow = new TableRow({
    children: [
      createTableCell("שם", colWidths[0], true),
      createTableCell("סוג מטבח", colWidths[1], true),
      createTableCell("כתובת", colWidths[2], true),
      createTableCell("טלפון", colWidths[3], true),
      createTableCell("דירוג", colWidths[4], true),
      createTableCell("ידידותי לילדים", colWidths[5], true),
      createTableCell("סטטוס", colWidths[6], true),
    ],
  })

  const dataRows = restaurants.map(
    (r) =>
      new TableRow({
        children: [
          createTableCell(r.name, colWidths[0]),
          createTableCell(r.cuisineType || "", colWidths[1]),
          createTableCell(r.address || "", colWidths[2]),
          createTableCell(r.phone || "", colWidths[3]),
          createTableCell(r.ratingGoogle ? String(r.ratingGoogle) : "", colWidths[4]),
          createTableCell(r.kidFriendly ? "כן" : "לא", colWidths[5]),
          createTableCell(statusMap[r.status] || r.status, colWidths[6]),
        ],
      })
  )

  elements.push(
    new Table({
      visuallyRightToLeft: true,
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: colWidths,
      rows: [headerRow, ...dataRows],
    })
  )

  elements.push(new Paragraph({ text: "" }))
  return elements
}

function buildPackingSection(items: TripData["packingItems"]): Paragraph[] {
  if (!items || items.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("רשימת ציוד", HeadingLevel.HEADING_2)]

  // Group by category
  const byCategory = new Map<string, typeof items>()
  for (const item of items) {
    const cat = item.category || "כללי"
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(item)
  }

  for (const [category, catItems] of byCategory) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120 },
        children: [new TextRun({ text: category, bold: true, rightToLeft: true })],
      })
    )
    for (const item of catItems) {
      const checkmark = item.checked ? "[x]" : "[ ]"
      const memberPart = item.forMember ? ` (${item.forMember})` : ""
      paragraphs.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `${checkmark} ${item.item}${memberPart}`,
              rightToLeft: true,
            }),
          ],
        })
      )
    }
  }

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

function buildShoppingSection(items: TripData["shoppingItems"]): Paragraph[] {
  if (!items || items.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading("רשימת קניות", HeadingLevel.HEADING_2)]

  const byCategory = new Map<string, typeof items>()
  for (const item of items) {
    const cat = item.category || "כללי"
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(item)
  }

  for (const [category, catItems] of byCategory) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120 },
        children: [new TextRun({ text: category, bold: true, rightToLeft: true })],
      })
    )
    for (const item of catItems) {
      const checkmark = item.checked ? "[x]" : "[ ]"
      paragraphs.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `${checkmark} ${item.item}`,
              rightToLeft: true,
            }),
          ],
        })
      )
    }
  }

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

export async function generateTripDocx(trip: TripData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    // Title - centered
    new Paragraph({
      heading: HeadingLevel.TITLE,
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: trip.name,
          bold: true,
          rightToLeft: true,
          size: 36,
          font: "Arial",
        }),
      ],
    }),
    // Subtitle - right-aligned
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${trip.destination} | ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`,
          rightToLeft: true,
          size: 24,
          color: "666666",
          font: "Arial",
        }),
      ],
    }),
    // Sections
    ...buildFlightSection(trip.flights),
    ...buildAccommodationSection(trip.accommodation),
    ...buildCarRentalSection(trip.carRental),
    ...buildScheduleSection(trip.dayPlans, trip.accommodation),
    ...buildAttractionsSection(trip.attractions),
    ...buildRestaurantsSection(trip.restaurants),
    ...buildPackingSection(trip.packingItems),
    ...buildShoppingSection(trip.shoppingItems),
  ]

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Arial", size: 22, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 100 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 80 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", rightToLeft: true },
          paragraph: { alignment: AlignmentType.CENTER },
        },
        {
          id: "ListParagraph",
          name: "List Paragraph",
          basedOn: "Normal",
          quickFormat: true,
          run: { font: "Arial", rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,  // A4
              height: 16838,
            },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}
