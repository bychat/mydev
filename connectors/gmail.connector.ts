/**
 * Gmail Connector
 * 
 * Integrates with the Gmail API for reading and sending emails.
 * Uses OAuth2 access token for authentication.
 */

import type { Connector, ConnectorActionResult } from '../core/connector';

export interface GmailConnectorConfig {
  accessToken: string;
  email: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export const gmailConnector: Connector<GmailConnectorConfig> = {
  metadata: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Gmail email integration — view inbox, read and send emails',
    icon: 'gmail',
    category: 'communication',
    version: '1.0.0',
  },

  configFields: [
    {
      key: 'email',
      label: 'Email Address',
      type: 'email',
      placeholder: 'you@gmail.com',
      required: true,
      helpText: 'Your Gmail email address',
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      type: 'password',
      placeholder: 'ya29.a0AfH6SM...',
      required: true,
      helpText: 'OAuth2 access token or app password for Gmail API',
    },
  ],

  actions: [
    { id: 'list-messages', name: 'List Messages', description: 'Fetch recent emails from inbox' },
    { id: 'get-message', name: 'Get Message', description: 'Get a specific email by ID' },
    { id: 'list-labels', name: 'List Labels', description: 'List all Gmail labels' },
    { id: 'send-message', name: 'Send Message', description: 'Send a new email' },
  ],

  async testConnection(config) {
    try {
      const res = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        },
      );
      if (res.ok) {
        return { success: true };
      }
      const body: any = await res.json().catch(() => ({}));
      const errMsg = body?.error?.message || `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    const headers = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };

    try {
      switch (actionId) {
        case 'list-messages': {
          const maxResults = (params.maxResults as number) || 20;
          const q = (params.query as string) || '';
          const labelIds = (params.labelIds as string) || 'INBOX';
          const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
          url.searchParams.set('maxResults', String(maxResults));
          if (q) url.searchParams.set('q', q);
          url.searchParams.set('labelIds', labelIds);

          const listRes = await fetch(url.toString(), { headers });
          if (!listRes.ok) {
            const err: any = await listRes.json().catch(() => ({}));
            return { success: false, error: err?.error?.message || `HTTP ${listRes.status}` };
          }
          const listData: any = await listRes.json();
          const messageStubs = listData.messages || [];

          // Fetch metadata for each message
          const messages = await Promise.all(
            messageStubs.slice(0, maxResults).map(async (stub: { id: string }) => {
              const msgRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date&metadataHeaders=To`,
                { headers },
              );
              if (!msgRes.ok) return null;
              const msg: any = await msgRes.json();
              const getHeader = (name: string) =>
                msg.payload?.headers?.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
              return {
                id: msg.id,
                threadId: msg.threadId,
                snippet: msg.snippet || '',
                subject: getHeader('Subject'),
                from: getHeader('From'),
                to: getHeader('To'),
                date: getHeader('Date'),
                labelIds: msg.labelIds || [],
                isUnread: (msg.labelIds || []).includes('UNREAD'),
              };
            }),
          );
          return { success: true, data: messages.filter(Boolean) };
        }

        case 'get-message': {
          const messageId = params.messageId as string;
          if (!messageId) return { success: false, error: 'messageId is required' };
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
            { headers },
          );
          if (!res.ok) {
            const err: any = await res.json().catch(() => ({}));
            return { success: false, error: err?.error?.message || `HTTP ${res.status}` };
          }
          const msg = await res.json();
          return { success: true, data: msg };
        }

        case 'list-labels': {
          const res = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/labels',
            { headers },
          );
          if (!res.ok) {
            const err: any = await res.json().catch(() => ({}));
            return { success: false, error: err?.error?.message || `HTTP ${res.status}` };
          }
          const data: any = await res.json();
          return { success: true, data: data.labels || [] };
        }

        case 'send-message': {
          const to = params.to as string;
          const subject = params.subject as string;
          const body = params.body as string;
          if (!to || !subject) return { success: false, error: 'to and subject are required' };

          const rawEmail = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body || '',
          ].join('\r\n');

          // Base64url encode
          const encoded = Buffer.from(rawEmail)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

          const res = await fetch(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            {
              method: 'POST',
              headers,
              body: JSON.stringify({ raw: encoded }),
            },
          );
          if (!res.ok) {
            const err: any = await res.json().catch(() => ({}));
            return { success: false, error: err?.error?.message || `HTTP ${res.status}` };
          }
          const data = await res.json();
          return { success: true, data };
        }

        default:
          return { success: false, error: `Unknown action: ${actionId}` };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
