import type { McpTool, ToolResult } from '@bank55/shared'
import type { Database } from '@bank55/shared'
import crypto from 'crypto'

export const tools: McpTool[] = [
  {
    name: 'send_notification',
    description: 'Send a notification to a customer via email, SMS, or push.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        customer_email: { type: 'string', description: 'Email address (optional, uses customer_id@bank55.local if omitted)' },
        customer_name: { type: 'string' },
        channel: { type: 'string', enum: ['email', 'sms', 'push', 'in_app'], description: 'Default: email' },
        type: { type: 'string', description: 'Notification type (transfer, payment, insurance, security, info)' },
        subject: { type: 'string' },
        body: { type: 'string' },
        metadata: { type: 'object', description: 'Additional context data' },
      },
      required: ['customer_id', 'type', 'subject', 'body'],
    },
  },
  {
    name: 'list_notifications',
    description: 'List notifications for a customer or all notifications.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'sent', 'failed', 'read'] },
        type: { type: 'string' },
        limit: { type: 'number', description: 'Default 20' },
      },
      required: [],
    },
  },
  {
    name: 'get_notification',
    description: 'Get details of a specific notification.',
    inputSchema: { type: 'object', properties: { notification_id: { type: 'string' } }, required: ['notification_id'] },
  },
  {
    name: 'get_notification_stats',
    description: 'Get notification statistics - sent, failed, pending counts.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' }, since: { type: 'string', description: 'ISO date' } }, required: [] },
  },
  {
    name: 'list_templates',
    description: 'List available notification templates.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'send_from_template',
    description: 'Send a notification using a template with variable substitution.',
    inputSchema: {
      type: 'object',
      properties: {
        template_name: { type: 'string', description: 'Template name (e.g. transfer_sent, loan_payment)' },
        customer_id: { type: 'string' },
        customer_email: { type: 'string' },
        customer_name: { type: 'string' },
        variables: { type: 'object', description: 'Key-value pairs for template substitution' },
      },
      required: ['template_name', 'customer_id', 'variables'],
    },
  },
  {
    name: 'get_preferences',
    description: 'Get notification preferences for a customer.',
    inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] },
  },
  {
    name: 'update_preferences',
    description: 'Update notification preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        email_enabled: { type: 'boolean' },
        sms_enabled: { type: 'boolean' },
        push_enabled: { type: 'boolean' },
        quiet_hours_start: { type: 'string', description: 'HH:MM' },
        quiet_hours_end: { type: 'string', description: 'HH:MM' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'resend_notification',
    description: 'Resend a failed notification.',
    inputSchema: { type: 'object', properties: { notification_id: { type: 'string' } }, required: ['notification_id'] },
  },
]

export async function handleTool(name: string, args: Record<string, unknown>, ctx: { db: Database; service: string; transporter: any }): Promise<ToolResult> {
  const { db, service, transporter } = ctx
  const text = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }] })
  const error = (t: string): ToolResult => ({ content: [{ type: 'text', text: t }], isError: true })

  switch (name) {
    case 'send_notification': {
      const id = `notif-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()
      const channel = (args.channel as string) || 'email'

      db.prepare(
        `INSERT INTO notifications (id, customer_id, channel, type, subject, body, metadata, status, sender, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(id, args.customer_id, channel, args.type, args.subject, args.body, JSON.stringify(args.metadata || {}), 'pending', service, now)

      if (channel === 'email') {
        try {
          await transporter.sendMail({
            from: '"Bank55" <noreply@bank55.co.za>',
            to: (args.customer_email as string) || `${args.customer_id}@bank55.local`,
            subject: args.subject as string,
            html: `<div style="font-family: sans-serif; padding: 20px;"><h2>${args.subject}</h2><p style="white-space:pre-line">${args.body}</p></div>`,
          })
          db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id)
        } catch (err: any) {
          db.prepare('UPDATE notifications SET status = ?, error = ? WHERE id = ?').run('failed', err.message, id)
          return text(`Notification created (${id}) but email delivery failed: ${err.message}`)
        }
      } else {
        db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id)
      }

      return text(`Notification sent!\n  ID: ${id}\n  To: ${args.customer_id}\n  Channel: ${channel}\n  Subject: ${args.subject}\n  Status: sent`)
    }

    case 'list_notifications': {
      let sql = 'SELECT * FROM notifications WHERE 1=1'
      const params: any[] = []
      if (args.customer_id) { sql += ' AND customer_id = ?'; params.push(args.customer_id) }
      if (args.status) { sql += ' AND status = ?'; params.push(args.status) }
      if (args.type) { sql += ' AND type = ?'; params.push(args.type) }
      sql += ' ORDER BY created_at DESC LIMIT ?'
      params.push((args.limit as number) || 20)
      const rows = db.prepare(sql).all(...params)
      if (!(rows as any[]).length) return text('No notifications found.')
      return text(JSON.stringify(rows, null, 2))
    }

    case 'get_notification': {
      const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(args.notification_id as string)
      if (!notif) return error('Notification not found')
      return text(JSON.stringify(notif, null, 2))
    }

    case 'get_notification_stats': {
      let where = 'WHERE 1=1'
      const params: any[] = []
      if (args.customer_id) { where += ' AND customer_id = ?'; params.push(args.customer_id) }
      if (args.since) { where += ' AND created_at >= ?'; params.push(args.since) }
      const stats = db.prepare(`SELECT status, COUNT(*) as count FROM notifications ${where} GROUP BY status`).all(...params)
      const total = (stats as any[]).reduce((s, r) => s + r.count, 0)
      const byType = db.prepare(`SELECT type, COUNT(*) as count FROM notifications ${where} GROUP BY type ORDER BY count DESC`).all(...params)
      return text(JSON.stringify({ total, by_status: stats, by_type: byType }, null, 2))
    }

    case 'list_templates': {
      const rows = db.prepare('SELECT * FROM templates WHERE active = 1').all()
      return text(JSON.stringify(rows, null, 2))
    }

    case 'send_from_template': {
      const template = db.prepare('SELECT * FROM templates WHERE name = ?').get(args.template_name as string) as any
      if (!template) return error(`Template "${args.template_name}" not found`)

      const vars = args.variables as Record<string, string>
      let subject = template.subject_template
      let body = template.body_template
      for (const [key, value] of Object.entries(vars)) {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value)
        body = body.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }

      const id = `notif-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO notifications (id, customer_id, channel, type, subject, body, metadata, status, sender, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(id, args.customer_id, template.channel, template.type, subject, body, JSON.stringify(vars), 'pending', service, now)

      try {
        await transporter.sendMail({
          from: '"Bank55" <noreply@bank55.co.za>',
          to: (args.customer_email as string) || `${args.customer_id}@bank55.local`,
          subject,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2>${subject}</h2><p style="white-space:pre-line">${body}</p></div>`,
        })
        db.prepare('UPDATE notifications SET status = ?, sent_at = ? WHERE id = ?').run('sent', now, id)
      } catch (err: any) {
        db.prepare('UPDATE notifications SET status = ?, error = ? WHERE id = ?').run('failed', err.message, id)
      }

      return text(`Sent from template "${args.template_name}":\n  ID: ${id}\n  Subject: ${subject}\n  To: ${args.customer_id}`)
    }

    case 'get_preferences': {
      const prefs = db.prepare('SELECT * FROM preferences WHERE customer_id = ?').get(args.customer_id as string)
      if (!prefs) return text(JSON.stringify({ customer_id: args.customer_id, email_enabled: true, sms_enabled: true, push_enabled: true, quiet_hours_start: null, quiet_hours_end: null, note: 'Using defaults (no custom preferences set)' }, null, 2))
      return text(JSON.stringify(prefs, null, 2))
    }

    case 'update_preferences': {
      const cid = args.customer_id as string
      const existing = db.prepare('SELECT * FROM preferences WHERE customer_id = ?').get(cid)
      if (existing) {
        const updates: string[] = []
        const params: any[] = []
        if (args.email_enabled !== undefined) { updates.push('email_enabled = ?'); params.push(args.email_enabled ? 1 : 0) }
        if (args.sms_enabled !== undefined) { updates.push('sms_enabled = ?'); params.push(args.sms_enabled ? 1 : 0) }
        if (args.push_enabled !== undefined) { updates.push('push_enabled = ?'); params.push(args.push_enabled ? 1 : 0) }
        if (args.quiet_hours_start) { updates.push('quiet_hours_start = ?'); params.push(args.quiet_hours_start) }
        if (args.quiet_hours_end) { updates.push('quiet_hours_end = ?'); params.push(args.quiet_hours_end) }
        if (updates.length) {
          params.push(cid)
          db.prepare(`UPDATE preferences SET ${updates.join(', ')} WHERE customer_id = ?`).run(...params)
        }
      } else {
        db.prepare('INSERT INTO preferences (customer_id, email_enabled, sms_enabled, push_enabled, quiet_hours_start, quiet_hours_end) VALUES (?,?,?,?,?,?)').run(
          cid, args.email_enabled !== false ? 1 : 0, args.sms_enabled !== false ? 1 : 0, args.push_enabled !== false ? 1 : 0, args.quiet_hours_start || null, args.quiet_hours_end || null
        )
      }
      return text(`Preferences updated for ${cid}`)
    }

    case 'resend_notification': {
      const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(args.notification_id as string) as any
      if (!notif) return error('Notification not found')
      if (notif.status !== 'failed') return error(`Cannot resend: status is "${notif.status}" (only "failed" can be resent)`)

      try {
        await transporter.sendMail({
          from: '"Bank55" <noreply@bank55.co.za>',
          to: `${notif.customer_id}@bank55.local`,
          subject: notif.subject,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2>${notif.subject}</h2><p style="white-space:pre-line">${notif.body}</p></div>`,
        })
        const now = new Date().toISOString()
        db.prepare('UPDATE notifications SET status = ?, sent_at = ?, error = NULL WHERE id = ?').run('sent', now, notif.id)
        return text(`Resent successfully: ${notif.id}`)
      } catch (err: any) {
        return error(`Resend failed: ${err.message}`)
      }
    }

    default:
      return error(`Unknown tool: ${name}`)
  }
}
