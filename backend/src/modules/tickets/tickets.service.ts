import { In, Repository } from 'typeorm';
import { Ticket } from './ticket.entity';
import { Reservation } from '../reservations/reservation.entity';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { AppDataSource } from '../../config/database.config';
import { config } from '../../config/app.config';
import { storageProvider } from '../../providers/storage/storage.provider';
import { generateTicketPdf } from '../../common/utils/pdf.util';
import { signQrPayload, verifyQrPayload, type QrPayload } from '../../common/utils/qr.util';
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/AppError';

export class TicketsService {
  private ticketRepo: Repository<Ticket>;
  private reservationRepo: Repository<Reservation>;
  private eventRepo: Repository<Event>;

  constructor() {
    this.ticketRepo = AppDataSource.getRepository(Ticket);
    this.reservationRepo = AppDataSource.getRepository(Reservation);
    this.eventRepo = AppDataSource.getRepository(Event);
  }

  async generateForReservations(
    userId: string,
    eventId: string,
    reservationIds: string[],
    seatIds: string[],
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['venue'] });
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const reservations = await this.reservationRepo.find({
      where: { id: In(reservationIds) },
      relations: ['seat', 'seat.section'],
    });

    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const tickets: Ticket[] = [];

    for (const reservation of reservations) {
      const seat = reservation.seat;
      if (!seat) continue;

      const ticket = this.ticketRepo.create({
        reservation,
        user: { id: user.id } as User,
        event,
        seat,
        qrPayload: '',
        ticketUrl: '',
      });
      await this.ticketRepo.save(ticket);

      const qrPayload = signQrPayload(ticket.id, user.id, eventId);
      ticket.qrPayload = JSON.stringify(qrPayload);

      const pdfBuffer = await generateTicketPdf({
        eventTitle: event.title,
        eventStartTime: event.startTime,
        venueName: event.venue?.name ?? '',
        sectionName: seat.section?.name ?? '',
        seatNumber: seat.seatNumber,
        buyerName: `${user.firstName} ${user.lastName}`,
        qrPayload: ticket.qrPayload,
      });

      const path = `tickets/${ticket.id}.pdf`;
      await storageProvider.upload(config.supabase.ticketsBucket, pdfBuffer, path, 'application/pdf');
      const signedUrl = await storageProvider.getSignedUrl(config.supabase.ticketsBucket, path);

      ticket.ticketUrl = signedUrl;
      await this.ticketRepo.save(ticket);
      tickets.push(ticket);
    }

    return tickets;
  }

  async myTickets(userId: string) {
    return this.ticketRepo.find({
      where: { user: { id: userId } },
      relations: ['event', 'seat', 'seat.section'],
      order: { createdAt: 'DESC' },
    });
  }

  async myTicketEvents(userId: string) {
    const tickets = await this.ticketRepo.find({
      where: { user: { id: userId } },
      relations: ['event', 'event.venue'],
      order: { createdAt: 'DESC' },
    });

    const grouped = new Map<string, { event: Event; ticketCount: number }>();
    for (const ticket of tickets) {
      if (!ticket.event) continue;
      const entry = grouped.get(ticket.event.id);
      if (entry) {
        entry.ticketCount += 1;
      } else {
        grouped.set(ticket.event.id, { event: ticket.event, ticketCount: 1 });
      }
    }
    return [...grouped.values()];
  }

  async getTicket(userId: string, ticketId: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['user', 'event', 'seat', 'seat.section'],
    });
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    if (ticket.user.id !== userId) {
      throw new ForbiddenError('Not your ticket');
    }
    const signedUrl = await storageProvider.getSignedUrl(
      config.supabase.ticketsBucket,
      `tickets/${ticket.id}.pdf`,
    );
    return {
      id: ticket.id,
      qrPayload: ticket.qrPayload,
      isUsed: ticket.isUsed,
      usedAt: ticket.usedAt,
      ticketUrl: signedUrl,
      event: ticket.event,
      seat: ticket.seat,
    };
  }

  async validate(qrPayload: string, scannerId: string) {
    let payload: QrPayload;
    try {
      payload = JSON.parse(qrPayload);
    } catch {
      throw new ValidationError('Invalid QR payload');
    }
    if (!verifyQrPayload(payload)) {
      throw new AuthError('Invalid ticket QR code');
    }

    const ticket = await this.ticketRepo.findOne({
      where: { id: payload.ticketId },
      relations: ['event', 'event.organizer', 'seat', 'seat.section'],
    });
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }
    if (ticket.event.organizer.id !== scannerId) {
      throw new ForbiddenError('Not your event');
    }
    if (ticket.isRefunded) {
      throw new AuthError('Ticket has been refunded');
    }
    if (ticket.isUsed) {
      return {
        ticket,
        alreadyUsed: true,
      };
    }
    ticket.isUsed = true;
    ticket.usedAt = new Date();
    await this.ticketRepo.save(ticket);
    return {
      ticket,
      alreadyUsed: false,
    };
  }
}
