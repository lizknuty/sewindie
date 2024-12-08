import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || (!body.designer_id && !body.new_designer_name)) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name or designer' }, { status: 400 })
    }

    // Set up Google Sheets API
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error('Missing Google Sheets credentials or spreadsheet ID')
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'), // Replace escaped newlines
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Prepare data for Google Sheets
    const rowData = [
      body.name,
      body.designer_id === 'not_listed' ? body.new_designer_name : body.designer_id,
      body.categories.join(', '),
      body.sizes,
      body.audience_id,
      body.publication_date ? new Date(body.publication_date).toISOString() : 'Unknown',
      body.published_in_print ? 'Yes' : 'No',
      body.published_online ? 'Yes' : 'No',
      body.pattern_url,
      body.is_free ? 'Free' : body.price,
      body.is_bundle ? 'Yes' : 'No',
      body.is_knit ? 'Knit' : '',
      body.is_woven ? 'Woven' : '',
      body.suggested_fabrics,
      body.required_notions,
      body.total_yardage
    ]

    // Append data to Google Sheet
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:P', // Updated to include all new columns
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      })
    } catch (sheetsError) {
      console.error('Error appending to Google Sheets:', sheetsError)
      return NextResponse.json({ success: false, error: 'Failed to submit pattern. Please try again later.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Pattern submitted successfully. Thank you for your contribution!' })
  } catch (error) {
    console.error('Error submitting pattern:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit pattern. Please try again later.' }, { status: 500 })
  }
}