import axios from "axios";
import nodemailer from "nodemailer";
import { ENV } from "../../config/env";

export type AlertSeverity = "critical" | "warning";

export type AlertPayload = {
  severity: AlertSeverity;
  modelId: string;
  provider: string;
  status: "active" | "deprecated" | "error" | "unknown";
  timestamp: string;
  message: string;
};

function formatAlertText(payload: AlertPayload) {
  const prefix = payload.severity === "critical" ? "CRITICAL" : "WARNING";
  return [
    `${prefix}: ${payload.message}`,
    `modelId=${payload.modelId}`,
    `provider=${payload.provider}`,
    `status=${payload.status}`,
    `timestamp=${payload.timestamp}`
  ].join(" | ");
}

function getAlertEmailRecipients() {
  if (!ENV.ALERT_EMAIL_TO) {
    return [];
  }

  return ENV.ALERT_EMAIL_TO.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function canSendEmail() {
  return Boolean(
    ENV.ALERT_EMAIL_FROM &&
      ENV.SMTP_HOST &&
      ENV.SMTP_USER &&
      ENV.SMTP_PASS
  );
}

function createEmailTransporter() {
  if (!canSendEmail()) {
    return null;
  }

  return nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE,
    auth: {
      user: ENV.SMTP_USER,
      pass: ENV.SMTP_PASS
    }
  });
}

async function sendEmailAlert(payload: AlertPayload) {
  const recipients = getAlertEmailRecipients();

  if (recipients.length === 0) {
    return;
  }

  if (!canSendEmail()) {
    for (const recipient of recipients) {
      const emailLog = {
        to: recipient,
        subject: `[${payload.severity.toUpperCase()}] ${payload.provider}/${payload.modelId}`,
        payload
      };

      console.log("EMAIL_LOG", JSON.stringify(emailLog));
    }

    return;
  }

  const transporter = createEmailTransporter();

  if (!transporter) {
    return;
  }

  const subject = `[${payload.severity.toUpperCase()}] ${payload.provider}/${payload.modelId}`;
  const text = formatAlertText(payload);

  for (const recipient of recipients) {
    await transporter.sendMail({
      from: ENV.ALERT_EMAIL_FROM,
      to: recipient,
      subject,
      text,
      html: `
        <h3>${payload.severity.toUpperCase()}: ${payload.message}</h3>
        <p><strong>Model ID:</strong> ${payload.modelId}</p>
        <p><strong>Provider:</strong> ${payload.provider}</p>
        <p><strong>Status:</strong> ${payload.status}</p>
        <p><strong>Timestamp:</strong> ${payload.timestamp}</p>
      `
    });
  }

  console.log(`Email alert sent to ${recipients.join(", ")}`);
}

export async function sendAlert(payload: AlertPayload) {
  const text = formatAlertText(payload);

  try {
    await sendEmailAlert(payload);
  } catch (error: any) {
    console.error("Email alert failed:", error.message);
  }

  if (!ENV.SLACK_WEBHOOK_URL) {
    console.log("No Slack webhook, logging structured alert instead:");
    console.log(JSON.stringify(payload));
    return;
  }

  try {
    await axios.post(ENV.SLACK_WEBHOOK_URL, {
      text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${payload.severity.toUpperCase()}* ${payload.message}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Model ID*\n${payload.modelId}`
            },
            {
              type: "mrkdwn",
              text: `*Provider*\n${payload.provider}`
            },
            {
              type: "mrkdwn",
              text: `*Status*\n${payload.status}`
            },
            {
              type: "mrkdwn",
              text: `*Timestamp*\n${payload.timestamp}`
            }
          ]
        }
      ]
    });

    console.log("Alert sent to Slack");
  } catch (error: any) {
    console.error("Slack alert failed:", error.message);
  }
}