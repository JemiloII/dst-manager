import db from '@server/db/schema.js';

export interface Ticket {
  id: number;
  user_id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  submitted_by?: string;
}

class TicketQueries {
  async findAll(): Promise<Ticket[]> {
    const result = await db.execute({
      sql: `SELECT t.*, u.display_name as submitted_by
            FROM tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC`,
      args: [],
    });
    return result.rows as unknown as Ticket[];
  }

  async findByUserId(userId: number): Promise<Ticket[]> {
    const result = await db.execute({
      sql: 'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC',
      args: [userId],
    });
    return result.rows as unknown as Ticket[];
  }

  async create(userId: number, subject: string, message: string): Promise<void> {
    await db.execute({
      sql: 'INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)',
      args: [userId, subject, message],
    });
  }

  async resolve(id: number): Promise<void> {
    await db.execute({
      sql: "UPDATE tickets SET status = 'resolved' WHERE id = ?",
      args: [id],
    });
  }
}

export default new TicketQueries();
