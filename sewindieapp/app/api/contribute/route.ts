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
    let credentials
    try {
      credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '')
    } catch (error) {
      console.error('Error parsing GOOGLE_APPLICATION_CREDENTIALS:', error)
      return NextResponse.json({ success: false, error: 'Invalid Google credentials configuration' }, { status: 500 })
    }

    if (!credentials) {
      return NextResponse.json({ success: false, error: 'Google credentials not found' }, { status: 500 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
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
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:P', // Updated to include all new columns
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    })

    return NextResponse.json({ success: true, message: 'Pattern submitted successfully to Google Sheets' })
  } catch (error) {
    console.error('Error submitting pattern:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit pattern' }, { status: 500 })
  }
}