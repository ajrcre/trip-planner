import { verifyTripAccess } from "../trip-access"
import { prisma } from "../prisma"

jest.mock("../prisma", () => ({
  prisma: {
    trip: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("../auth", () => ({
  getAuthSession: jest.fn(),
}))

const mockFindUnique = prisma.trip.findUnique as jest.MockedFunction<
  typeof prisma.trip.findUnique
>

const baseTrip = {
  id: "trip1",
  userId: "owner1",
  shares: [],
  name: "Test",
  destination: "Paris",
  startDate: new Date(),
  endDate: new Date(),
  shareToken: null,
  accommodation: null,
  flights: null,
  carRental: null,
  destinationInfo: null,
  familyProfileId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("verifyTripAccess", () => {
  it("returns role owner for trip owner", async () => {
    mockFindUnique.mockResolvedValueOnce(baseTrip as any)
    const result = await verifyTripAccess("trip1", "owner1")
    expect(result).not.toBeNull()
    expect(result?.role).toBe("owner")
  })

  it("returns role editor for shared editor", async () => {
    mockFindUnique.mockResolvedValueOnce({
      ...baseTrip,
      shares: [{ userId: "user2", role: "editor" }],
    } as any)
    const result = await verifyTripAccess("trip1", "user2")
    expect(result?.role).toBe("editor")
  })

  it("returns role viewer for shared viewer", async () => {
    mockFindUnique.mockResolvedValueOnce({
      ...baseTrip,
      shares: [{ userId: "user3", role: "viewer" }],
    } as any)
    const result = await verifyTripAccess("trip1", "user3")
    expect(result?.role).toBe("viewer")
  })

  it("returns null for unauthorized user", async () => {
    mockFindUnique.mockResolvedValueOnce(baseTrip as any)
    const result = await verifyTripAccess("trip1", "stranger")
    expect(result).toBeNull()
  })
})
