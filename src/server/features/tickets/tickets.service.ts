import Tickets from './tickets.queries.js';

class TicketService {
  async getTickets(userId: number, isAdmin: boolean) {
    if (isAdmin) return Tickets.findAll();
    return Tickets.findByUserId(userId);
  }

  async createTicket(userId: number, subject: string, message: string) {
    await Tickets.create(userId, subject, message);
  }

  async resolveTicket(id: number) {
    await Tickets.resolve(id);
  }
}

export const ticketService = new TicketService();
