import { google } from "googleapis"

export interface PatternContribution {
  rowIndex: number
  name: string
  designer: string
  categories: string
  sizes: string
  audience: string
  publicationDate: string
  publishedInPrint: string
  publishedOnline: string
  patternUrl: string
  price: string
  isBundle: string
  isKnit: string
  isWoven: string
  suggestedFabrics: string
  requiredNotions: string
  totalYardage: string
  status: string
}

export async function getPatternContributions(): Promise<PatternContribution[]> {
  try {
    // Set up Google Sheets API
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error("Missing Google Sheets credentials or spreadsheet ID")
      return []
    }

    // Properly format the private key
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n").replace(/"/g, "")

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    // Get data from Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A2:Q", // Include status column (Q)
    })

    const rows = response.data.values || []

    // Map rows to PatternContribution objects
    return rows.map((row, index) => ({
      rowIndex: index + 2, // +2 because we start from A2 (1-indexed)
      name: row[0] || "",
      designer: row[1] || "",
      categories: row[2] || "",
      sizes: row[3] || "",
      audience: row[4] || "",
      publicationDate: row[5] || "",
      publishedInPrint: row[6] || "",
      publishedOnline: row[7] || "",
      patternUrl: row[8] || "",
      price: row[9] || "",
      isBundle: row[10] || "",
      isKnit: row[11] || "",
      isWoven: row[12] || "",
      suggestedFabrics: row[13] || "",
      requiredNotions: row[14] || "",
      totalYardage: row[15] || "",
      status: row[16] || "Pending", // Status column
    }))
  } catch (error) {
    console.error("Error fetching pattern contributions:", error)
    return []
  }
}

export async function updateContributionStatus(rowIndex: number, status: string): Promise<boolean> {
  try {
    // Set up Google Sheets API
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error("Missing Google Sheets credentials or spreadsheet ID")
      return false
    }

    // Properly format the private key
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n").replace(/"/g, "")

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const sheets = google.sheets({ version: "v4", auth })

    // Update status in Google Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!Q${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[status]],
      },
    })

    return true
  } catch (error) {
    console.error("Error updating contribution status:", error)
    return false
  }
}
