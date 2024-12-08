import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('Received body:', JSON.stringify(body, null, 2))

    // Validate required fields
    if (!body.name || (!body.designer_id && !body.new_designer_name)) {
      return NextResponse.json({ success: false, error: 'Missing required fields: name or designer' }, { status: 400 })
    }

    // Set up Google Sheets API
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

    console.log('Environment variables:', {
      GOOGLE_SHEETS_CLIENT_EMAIL: clientEmail ? 'Set' : 'Not set',
      GOOGLE_SHEETS_PRIVATE_KEY: privateKey ? `Set (length: ${privateKey.length})` : 'Not set',
      GOOGLE_SHEETS_SPREADSHEET_ID: spreadsheetId ? 'Set' : 'Not set',
    })

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error('Missing Google Sheets credentials or spreadsheet ID')
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    // Properly format the private key
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '')
    console.log('Formatted private key (first 50 chars):', formattedPrivateKey.substring(0, 50))

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedPrivateKey,
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

    console.log('Row data prepared:', rowData)

    // Append data to Google Sheet
    try {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:P', // Updated to include all new columns
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData],
        },
      })
      console.log('Google Sheets API response:', JSON.stringify(response.data, null, 2))
    } catch (error) {
      console.error('Error appending to Google Sheets:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return NextResponse.json({ success: false, error: 'Failed to submit pattern to Google Sheets: ' + errorMessage }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Pattern submitted successfully. Thank you for your contribution!' })
  } catch (error) {
    console.error('Error submitting pattern:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ success: false, error: 'Failed to submit pattern: ' + errorMessage }, { status: 500 })
  }
}