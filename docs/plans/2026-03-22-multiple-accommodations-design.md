# Multiple Accommodations Design

## Problem

Trips often have different accommodations (e.g., airport hotel for the first night, main hotel for the rest). Currently the system supports only a single accommodation per trip.

## Design

### Data Model

Change `accommodation` JSON field on Trip from a single object to an **array of objects**. Each object keeps the same shape:

```ts
{ name, address, checkIn, checkOut, contact, bookingReference, coordinates? }
```

Existing single-accommodation data gets wrapped in `[existingAccommodation]` for backward compatibility.

### Itinerary Day Labels

For each day in the schedule, determine which accommodation covers that night by matching the day's date against each accommodation's check-in/check-out range:

- **Regular day** within a stay: subtle badge "🏨 Hilton Airport Hotel"
- **Check-in day**: "Check-in: Hilton Airport Hotel"
- **Check-out day**: "Check-out: Hilton Airport Hotel"
- **Transition day** (check-out + check-in same day): both badges shown

Purely a display concern — computed from accommodations array + day dates, no new DB fields.

### Form UI

- Current single accommodation form becomes a **repeatable card**
- "Add Accommodation" button appends a new empty card
- Each card has a remove button (except if it's the only one with data)
- Cards ordered by check-in date

### Affected Areas

| Area | Change |
|------|--------|
| Prisma schema | Data format changes (array), no schema migration needed since it's JSON |
| Trip creation/update APIs | Handle array, geocode each accommodation's address |
| TripForm | Repeatable card pattern for accommodation input |
| TripDashboard | Display/edit multiple accommodations |
| ScheduleView | Accommodation badge per day based on date matching |
| Export (DOCX) | List all accommodations |
| Gemini extraction | Extract multiple accommodations from documents |
| TripMap | Pins for all accommodations |
| Travel time calculations | Use accommodation relevant to that day's date |
