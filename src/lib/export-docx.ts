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
  Packer,
} from "docx"

interface FlightInfo {
  flightNumber?: string
  departureAirport?: string
  departureTime?: string
  arrivalAirport?: string
  arrivalTime?: string
}

interface TripData {
  name: string
  destination: string
  startDate: string
  endDate: string
  accommodation: {
    name?: string
    address?: string
    checkIn?: string
    checkOut?: string
    contact?: string
    bookingReference?: string
  } | null
  flights: {
    outbound?: FlightInfo
    return?: FlightInfo
  } | null
  carRental: {
    company?: string
    pickupLocation?: string
    returnLocation?: string
    additionalDetails?: string
  } | null
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

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
} as const

function createTableCell(text: string, isHeader = false): TableCell {
  return new TableCell({
    borders: cellBorders,
    children: [
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text,
            bold: isHeader,
            rightToLeft: true,
            size: isHeader ? 22 : 20,
          }),
        ],
      }),
    ],
  })
}

function buildFlightSection(flights: TripData["flights"]): Paragraph[] {
  if (!flights) return []
  const paragraphs: Paragraph[] = [createHeading("טיסות", HeadingLevel.HEADING_2)]

  if (flights.outbound?.flightNumber) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "טיסת הלוך", bold: true, rightToLeft: true })],
      })
    )
    paragraphs.push(createInfoParagraph("מספר טיסה", flights.outbound.flightNumber))
    if (flights.outbound.departureAirport)
      paragraphs.push(
        createInfoParagraph(
          "יציאה",
          `${flights.outbound.departureAirport}${flights.outbound.departureTime ? ` - ${formatDateTime(flights.outbound.departureTime)}` : ""}`
        )
      )
    if (flights.outbound.arrivalAirport)
      paragraphs.push(
        createInfoParagraph(
          "נחיתה",
          `${flights.outbound.arrivalAirport}${flights.outbound.arrivalTime ? ` - ${formatDateTime(flights.outbound.arrivalTime)}` : ""}`
        )
      )
  }

  if (flights.return?.flightNumber) {
    paragraphs.push(
      new Paragraph({
        bidirectional: true,
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "טיסת חזור", bold: true, rightToLeft: true })],
      })
    )
    paragraphs.push(createInfoParagraph("מספר טיסה", flights.return.flightNumber))
    if (flights.return.departureAirport)
      paragraphs.push(
        createInfoParagraph(
          "יציאה",
          `${flights.return.departureAirport}${flights.return.departureTime ? ` - ${formatDateTime(flights.return.departureTime)}` : ""}`
        )
      )
    if (flights.return.arrivalAirport)
      paragraphs.push(
        createInfoParagraph(
          "נחיתה",
          `${flights.return.arrivalAirport}${flights.return.arrivalTime ? ` - ${formatDateTime(flights.return.arrivalTime)}` : ""}`
        )
      )
  }

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

function buildAccommodationSection(acc: TripData["accommodation"]): Paragraph[] {
  if (!acc || (!acc.name && !acc.address)) return []
  const paragraphs: Paragraph[] = [createHeading("לינה", HeadingLevel.HEADING_2)]

  if (acc.name) paragraphs.push(createInfoParagraph("שם", acc.name))
  if (acc.address) paragraphs.push(createInfoParagraph("כתובת", acc.address))
  if (acc.checkIn) paragraphs.push(createInfoParagraph("צ'ק-אין", formatDateTime(acc.checkIn)))
  if (acc.checkOut) paragraphs.push(createInfoParagraph("צ'ק-אאוט", formatDateTime(acc.checkOut)))
  if (acc.contact) paragraphs.push(createInfoParagraph("פרטי קשר", acc.contact))
  if (acc.bookingReference) paragraphs.push(createInfoParagraph("מספר הזמנה", acc.bookingReference))

  paragraphs.push(new Paragraph({ text: "" }))
  return paragraphs
}

function buildCarRentalSection(car: TripData["carRental"]): Paragraph[] {
  if (!car || (!car.company && !car.pickupLocation)) return []
  const paragraphs: Paragraph[] = [createHeading("השכרת רכב", HeadingLevel.HEADING_2)]

  if (car.company) paragraphs.push(createInfoParagraph("חברה", car.company))
  if (car.pickupLocation) paragraphs.push(createInfoParagraph("מיקום איסוף", car.pickupLocation))
  if (car.returnLocation) paragraphs.push(createInfoParagraph("מיקום החזרה", car.returnLocation))
  if (car.additionalDetails) paragraphs.push(createInfoParagraph("פרטים נוספים", car.additionalDetails))

  paragraphs.push(new Paragraph({ text: "" }))
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

  const headerRow = new TableRow({
    children: [
      createTableCell("שם", true),
      createTableCell("כתובת", true),
      createTableCell("טלפון", true),
      createTableCell("דירוג", true),
      createTableCell("סטטוס", true),
      createTableCell("הערות", true),
    ],
  })

  const statusMap: Record<string, string> = {
    approved: "מאושר",
    maybe: "אולי",
    rejected: "נדחה",
  }

  const dataRows = attractions.map(
    (a) =>
      new TableRow({
        children: [
          createTableCell(a.name),
          createTableCell(a.address || ""),
          createTableCell(a.phone || ""),
          createTableCell(a.ratingGoogle ? String(a.ratingGoogle) : ""),
          createTableCell(statusMap[a.status] || a.status),
          createTableCell(
            [
              a.bookingRequired ? "דורש הזמנה" : "",
              a.specialNotes || "",
            ]
              .filter(Boolean)
              .join(", ")
          ),
        ],
      })
  )

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    })
  )

  elements.push(new Paragraph({ text: "" }))
  return elements
}

function buildRestaurantsSection(restaurants: TripData["restaurants"]): (Paragraph | Table)[] {
  if (!restaurants || restaurants.length === 0) return []
  const elements: (Paragraph | Table)[] = [createHeading("מסעדות", HeadingLevel.HEADING_2)]

  const headerRow = new TableRow({
    children: [
      createTableCell("שם", true),
      createTableCell("סוג מטבח", true),
      createTableCell("כתובת", true),
      createTableCell("טלפון", true),
      createTableCell("דירוג", true),
      createTableCell("ידידותי לילדים", true),
      createTableCell("סטטוס", true),
    ],
  })

  const statusMap: Record<string, string> = {
    approved: "מאושר",
    maybe: "אולי",
    rejected: "נדחה",
  }

  const dataRows = restaurants.map(
    (r) =>
      new TableRow({
        children: [
          createTableCell(r.name),
          createTableCell(r.cuisineType || ""),
          createTableCell(r.address || ""),
          createTableCell(r.phone || ""),
          createTableCell(r.ratingGoogle ? String(r.ratingGoogle) : ""),
          createTableCell(r.kidFriendly ? "כן" : "לא"),
          createTableCell(statusMap[r.status] || r.status),
        ],
      })
  )

  elements.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
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
    // Title
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
        }),
      ],
    }),
    // Subtitle with destination and dates
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${trip.destination} | ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`,
          rightToLeft: true,
          size: 24,
          color: "666666",
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
    sections: [
      {
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}
