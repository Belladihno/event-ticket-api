function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function wrapHtml(title: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a202c;">
      <h2 style="color: #2b6cb0;">${title}</h2>
      ${body}
    </div>
  `;
}

export function bookingConfirmationHtml(input: {
  eventTitle: string;
  eventStartTime: string;
  venueName: string;
  seatCount: number;
  ticketUrl: string;
}): string {
  return wrapHtml(
    `Your ticket is ready for ${input.eventTitle}`,
    `
      <p>Thank you for your purchase. Your booking has been confirmed.</p>
      <ul>
        <li><strong>Event:</strong> ${input.eventTitle}</li>
        <li><strong>Date:</strong> ${formatDate(input.eventStartTime)}</li>
        <li><strong>Venue:</strong> ${input.venueName}</li>
        <li><strong>Tickets:</strong> ${input.seatCount}</li>
      </ul>
      <p>
        <a href="${input.ticketUrl}" style="background: #2b6cb0; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Download your ticket
        </a>
      </p>
      <p style="color: #718096; font-size: 12px;">The download link expires in 5 minutes for security.</p>
    `,
  );
}

export function eventReminderHtml(input: {
  eventTitle: string;
  eventStartTime: string;
  venueName: string;
}): string {
  return wrapHtml(
    `Reminder: ${input.eventTitle} starts soon`,
    `
      <p>This is a friendly reminder about your upcoming event.</p>
      <ul>
        <li><strong>Event:</strong> ${input.eventTitle}</li>
        <li><strong>Date:</strong> ${formatDate(input.eventStartTime)}</li>
        <li><strong>Venue:</strong> ${input.venueName}</li>
      </ul>
      <p>Don't forget to bring your ticket. See you there!</p>
    `,
  );
}

export function paymentFailedHtml(input: { eventTitle: string; amount: string }): string {
  return wrapHtml(
    `Payment failed for ${input.eventTitle}`,
    `
      <p>Unfortunately, your payment of <strong>${input.amount}</strong> for <strong>${input.eventTitle}</strong> could not be processed.</p>
      <p>Your seats have been released and the event reservation is no longer held. You can try again to complete your purchase.</p>
    `,
  );
}

export function verificationEmailHtml(input: { code: string }): string {
  return wrapHtml(
    'Verify your email address',
    `
      <p>Welcome! Please confirm your email address to activate your account.</p>
      <p>Enter this verification code in the app:</p>
      <p>
        <span class="otp-code" style="display:inline-block; font-size:28px; font-weight:700; letter-spacing:6px; color:#2b6cb0;">${input.code}</span>
      </p>
      <p style="color: #718096; font-size: 12px;">The code expires in 15 minutes. If you did not create an account, you can ignore this email.</p>
    `,
  );
}

export function passwordResetHtml(input: { code: string }): string {
  return wrapHtml(
    'Reset your password',
    `
      <p>We received a request to reset your password. Enter the code below to choose a new one:</p>
      <p>
        <span class="otp-code" style="display:inline-block; font-size:28px; font-weight:700; letter-spacing:6px; color:#2b6cb0;">${input.code}</span>
      </p>
      <p style="color: #718096; font-size: 12px;">The code expires in 15 minutes. If you did not request a reset, you can ignore this email.</p>
    `,
  );
}
