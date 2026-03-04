interface EmailTemplate {
  subject: string
  html: (data: any) => string
  text: (data: any) => string
}

export const emailTemplates: { [key: string]: EmailTemplate } = {
  passwordReset: {
    subject: "Password Reset Request",
    html: (data: { resetLink: string }) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          
          <p>You are receiving this because you (or someone else) have requested the reset of the password for your account.</p>
          
          <p>Please click on the following link, or paste this into your browser to complete the process:</p>
          
          <p style="text-align: center;">
            <a href="${data.resetLink}" class="button">Reset Password</a>
          </p>
          
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
          
          <div class="footer">
            <p>If you have any questions, please contact support@sewindie.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: (data: { resetLink: string }) => `
      You are receiving this because you (or someone else) have requested the reset of the password for your account.
      Please click on the following link, or paste this into your browser to complete the process:
      ${data.resetLink}
      If you did not request this, please ignore this email and your password will remain unchanged.
    `,
  },
  // Add other email templates here (e.g., welcome, order confirmation)
}
