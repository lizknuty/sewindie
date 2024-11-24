import { google } from 'googleapis'
import { NextResponse } from 'next/server'

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, designer, url } = body

    const range = 'Sheet1!A:C'
    const valueInputOption = 'USER_ENTERED'
    const resource = {
      values: [[name, designer, url]],
    }

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range,
      valueInputOption,
      requestBody: resource,
    })

    return NextResponse.json({ message: 'Submission successful' }, { status: 200 })
  } catch (error) {
    console.error('Error submitting to Google Sheets:', error)
    return NextResponse.json({ message: 'Error submitting form' }, { status: 500 })
  }
}