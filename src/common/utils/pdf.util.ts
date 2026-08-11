import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface TicketPdfData {
  eventTitle: string;
  eventStartTime: Date;
  venueName: string;
  sectionName: string;
  seatNumber: string;
  buyerName: string;
  qrPayload: string;
}

export async function generateTicketPdf(data: TicketPdfData): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(data.qrPayload, { width: 200, margin: 1 });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 48 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 90).fill('#1d4ed8');
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(22).text(data.eventTitle, 48, 32);

    doc.fill('#111827').font('Helvetica').fontSize(12).text(`Date: ${data.eventStartTime.toLocaleString()}`, 48, 130);
    doc.text(`Venue: ${data.venueName}`, 48, 152);

    doc.font('Helvetica-Bold').text(`Section: ${data.sectionName}`, 48, 190);
    doc.font('Helvetica').text(`Seat: ${data.seatNumber}`, 48, 212);
    doc.font('Helvetica').text(`Ticket for: ${data.buyerName}`, 48, 234);

    const qrX = doc.page.width - 200 - 48;
    const qrY = 150;
    doc.image(qrBuffer, qrX, qrY, { width: 180, height: 180 });

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6b7280')
      .text('Scan this QR code at the venue entrance to validate your ticket.', 48, 380);

    doc.end();
  });
}
