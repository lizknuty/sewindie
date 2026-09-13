// Colors and fonts mirror app/styles.css so the email reads as part of the SewIndie brand:
// --site-plum #8a3f5c (header/footer chrome), --color-primary #ea4e76 (CTA),
// --site-blush #f7e6e6 and --color-light #ebdee0 (backdrops), --color-dark #070607 (ink).
// Fonts match the site: Poiret One (--font-brand, the "SewIndie" mark), Open Sans
// (--font-heading), Inter (--font-body). Email clients are unreliable with web fonts,
// so we link Google Fonts for clients that honor it (e.g. Apple Mail) and pair every
// family with a web-safe fallback stack that degrades gracefully everywhere else.
export const getPasswordResetEmailTemplate = (resetUrl: string, userName = "there") => {
  const plum = "#8a3f5c"
  const primary = "#ea4e76"
  const blush = "#f7e6e6"
  const pageBg = "#ebdee0"
  const ink = "#2b2426"
  const muted = "#8f7a7c"
  // Poiret One is a thin geometric face; Century Gothic is the closest web-safe fallback.
  const brandFont = "'Poiret One', 'Century Gothic', 'Trebuchet MS', sans-serif"
  const headingFont = "'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
  const bodyFont = "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <title>Reset Your Password</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Open+Sans:wght@400;700&family=Poiret+One&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0; padding:0; background-color:${pageBg}; font-family:${bodyFont};">
      <span style="display:none !important; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden; mso-hide:all;">Reset your SewIndie password — this link expires in 1 hour.</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${pageBg};">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 12px 28px rgba(43,36,38,0.12);">
              <!-- Brand header -->
              <tr>
                <td align="center" style="background-color:${plum}; padding:28px 24px;">
                  <span style="color:#ffffff; font-size:32px; letter-spacing:2px; font-weight:400; font-family:${brandFont};">SewIndie</span>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:36px 40px 8px;">
                  <h1 style="margin:0 0 20px; color:${ink}; font-size:22px; font-weight:700; font-family:${headingFont};">Reset your password</h1>
                  <p style="margin:0 0 16px; color:${ink}; font-size:15px; line-height:1.6;">Hi ${userName},</p>
                  <p style="margin:0 0 16px; color:${ink}; font-size:15px; line-height:1.6;">We received a request to reset the password for your SewIndie account. If you didn&apos;t make this request, you can safely ignore this email.</p>
                  <p style="margin:0 0 28px; color:${ink}; font-size:15px; line-height:1.6;">Click the button below to choose a new password:</p>
                </td>
              </tr>
              <!-- CTA button -->
              <tr>
                <td align="center" style="padding:0 40px 32px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="border-radius:50px; background-color:${primary};">
                        <a href="${resetUrl}" target="_blank" style="display:inline-block; padding:14px 40px; color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:50px; font-family:${headingFont};">Reset Password</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Fallback link -->
              <tr>
                <td style="padding:0 40px 32px;">
                  <p style="margin:0 0 8px; color:${muted}; font-size:13px; line-height:1.6;">Or copy and paste this link into your browser:</p>
                  <p style="margin:0; font-size:13px; line-height:1.6; word-break:break-all;"><a href="${resetUrl}" target="_blank" style="color:${primary}; text-decoration:underline;">${resetUrl}</a></p>
                </td>
              </tr>
              <!-- Notice strip -->
              <tr>
                <td style="padding:0 40px 36px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${blush}; border-radius:10px;">
                    <tr>
                      <td style="padding:14px 18px; color:${ink}; font-size:13px; line-height:1.6;">For your security, this link will expire in <strong>1 hour</strong>.</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <!-- Footer -->
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px;">
              <tr>
                <td align="center" style="padding:24px 24px 8px;">
                  <p style="margin:0 0 6px; color:${muted}; font-size:12px; line-height:1.6;">Need help? Contact us at <a href="mailto:support@sewindie.com" style="color:${plum}; text-decoration:none;">support@sewindie.com</a></p>
                  <p style="margin:0; color:${muted}; font-size:12px; line-height:1.6;">&copy; ${new Date().getFullYear()} SewIndie. Explore and share sewing patterns.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}
