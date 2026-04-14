import { prisma } from "../prisma"

jest.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: jest.fn(() => ({})),
}))

jest.mock("next-auth/providers/google", () => ({
  __esModule: true,
  default: jest.fn(() => ({ id: "google" })),
}))

jest.mock("../prisma", () => ({
  prisma: {
    tripInvite: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    tripShare: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  },
}))

// We'll import resolveInvitesForUser after it's exported from auth.ts
let resolveInvitesForUser: (user: { email?: string | null; id?: string | null }) => Promise<void>

beforeAll(async () => {
  // Dynamic import to avoid ESM issues with next-auth at module load time
  const authModule = await import("../auth")
  resolveInvitesForUser = authModule.resolveInvitesForUser
})

describe("resolveInvitesForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("creates TripShare records and deletes invites for matching email", async () => {
    const mockInvites = [
      { id: "inv1", tripId: "trip1", role: "editor", invitedEmail: "test@example.com", invitedBy: "owner1", createdAt: new Date() },
    ]
    ;(prisma.tripInvite.findMany as jest.Mock).mockResolvedValueOnce(mockInvites)
    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([])

    await resolveInvitesForUser({ email: "test@example.com", id: "user1" })

    expect(prisma.tripInvite.findMany).toHaveBeenCalledWith({
      where: { invitedEmail: "test@example.com" },
    })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it("does nothing if no pending invites", async () => {
    ;(prisma.tripInvite.findMany as jest.Mock).mockResolvedValueOnce([])

    await resolveInvitesForUser({ email: "test@example.com", id: "user1" })

    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("does nothing if email is null", async () => {
    await resolveInvitesForUser({ email: null, id: "user1" })
    expect(prisma.tripInvite.findMany).not.toHaveBeenCalled()
  })

  it("does nothing if id is null", async () => {
    await resolveInvitesForUser({ email: "test@example.com", id: null })
    expect(prisma.tripInvite.findMany).not.toHaveBeenCalled()
  })
})
