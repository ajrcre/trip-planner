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

// A4 page: 11906 DXA wide, 1440 DXA margins each side = 9026 DXA content width
const CONTENT_WIDTH = 9026

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
    flightNumber?: string
    departureAirport?: string
    departureTime?: string
    arrivalAirport?: string
    arrivalTime?: string
  }> | null
  carRental: Array<{
    company?: string
    pickupLocation?: string
    pickupTime?: string
    returnLocation?: string
    returnTime?: string
    additionalDetails?: string
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
      attraction?: { name: string } | null
      restaurant?: { name: string } | null
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
          `${flight.departureAirport}${flight.departureTime ? ` - ${formatDateTime(flight.departureTime)}` : ""}`
        )
      )
    }
    if (flight.arrivalAirport) {
      paragraphs.push(
        createInfoParagraph(
          "נחיתה",
          `${flight.arrivalAirport}${flight.arrivalTime ? ` - ${formatDateTime(flight.arrivalTime)}` : ""}`
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
    if (acc.checkIn) paragraphs.push(createInfoParagraph("צ'ק-אין", formatDateTime(acc.checkIn)))
    if (acc.checkOut) paragraphs.push(createInfoParagraph("צ'ק-אאוט", formatDateTime(acc.checkOut)))
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
    if (car.pickupTime) paragraphs.push(createInfoParagraph("זמן איסוף", formatDateTime(car.pickupTime)))
    if (car.returnLocation) paragraphs.push(createInfoParagraph("מיקום החזרה", car.returnLocation))
    if (car.returnTime) paragraphs.push(createInfoParagraph("זמן החזרה", formatDateTime(car.returnTime)))
    if (car.additionalDetails) paragraphs.push(createInfoParagraph("פרטים נוספים", car.additionalDetails))
    paragraphs.push(new Paragraph({ text: "" }))
  }

  return paragraphs
}

function buildScheduleSection(dayPlans: TripData["dayPlans"]): Paragraph[] {
  if (!dayPlans || dayPlans.length === 0) return []
  const paragraphs: Paragraph[] = [createHeading('לו"ז יומי', HeadingLevel.HEADING_2)]

  for (const day of dayPlans) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: `${formatDate(day.date)} - ${day.dayType === "travel" ? "יום נסיעה" : day.dayType === "rest" ? "יום מנוחה" : "יום טיול"}`,
            bold: true,
            rightToLeft: true,
            size: 24,
          }),
        ],
      })
    )

    for (const activity of day.activities) {
      const timePart = activity.timeStart ? `${activity.timeStart}${activity.timeEnd ? `-${activity.timeEnd}` : ""}` : ""
      const namePart =
        activity.type === "attraction" && activity.attraction
          ? activity.attraction.name
          : activity.type === "restaurant" && activity.restaurant
            ? activity.restaurant.name
            : activity.type === "travel"
              ? "נסיעה"
              : activity.type === "free_time"
                ? "זמן חופשי"
                : activity.type
      const notesPart = activity.notes ? ` (${activity.notes})` : ""

      paragraphs.push(
        new Paragraph({
          bidirectional: true,
          alignment: AlignmentType.RIGHT,
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `${timePart ? timePart + " - " : ""}${namePart}${notesPart}`,
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
    ...buildScheduleSection(trip.dayPlans),
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
