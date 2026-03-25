import { NextResponse } from "next/server"
import { getAuthSession } from "@/lib/auth"
import { extractTripDetails } from "@/lib/gemini"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]

export async function POST(request: Request) {
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not supported. Use PDF, JPG, or PNG." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 10MB." },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString("base64")
    const extracted = await extractTripDetails(base64, file.type)
    return NextResponse.json(extracted)
  } catch (error) {
    console.error("Extraction error:", error)
    return NextResponse.json(
      { error: "Failed to extract trip details from file" },
      { status: 500 }
    )
  }
}
