import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendVerificationEmail = async (email, fullName, token) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify?token=${token}`

  const { data, error } = await resend.emails.send({
    from: 'AgriTech GH <no-reply@agritechgh.me>',
    to: email,
    subject: 'Verify your AgriTech GH account',
    html: `  <h2>Welcome to AgriTech GH, ${fullName}!</h2>
      <p>Please verify your email address by clicking the button below.</p>
     <a href="${verificationUrl}" style="
      background-color: #16a34a;
        color: white;
       padding: 12px 24px;
       text-decoration: none;
      border-radius: 6px;
      display: inline-block;
        margin: 16px 0;
     ">Verify Email</a>
      <p>Or copy this link: ${verificationUrl}</p>
     <p>This link expires in 24 hours.</p>
     <p>If you didn't create this account, ignore this email.</p>`
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(error.message)
  }

  console.log('Email sent:', data)
}

