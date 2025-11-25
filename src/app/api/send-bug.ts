// pages/api/send-bug.ts
import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { File as FormidableFile, Files } from "formidable";
import fs from "fs";
import nodemailer from "nodemailer";

export const config = {
    api: {
        bodyParser: false, // required for formidable
    },
};

type ParsedForm = {
    fields: Record<string, any>;
    files: Files;
};

function parseForm(req: NextApiRequest): Promise<ParsedForm> {
    const form = formidable({ multiples: true });
    return new Promise((resolve, reject) => {
        form.parse(req as any, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
}

function cleanupTempFiles(files: Files | undefined) {
    if (!files) return;
    for (const key of Object.keys(files)) {
        const val = files[key];
        const rm = (f: FormidableFile) => {
            const p = String(f.filepath || "");
            if (p && fs.existsSync(p)) {
                fs.unlink(p, (err) => {
                    if (err) console.warn("Failed to remove temp file:", p, err);
                });
            }
        };
        if (Array.isArray(val)) {
            for (const f of val) {
                if (f && typeof f === "object") rm(f as FormidableFile);
            }
        } else if (val && typeof val === "object") {
            rm(val as FormidableFile);
        }
    }
}

function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { fields, files } = await parseForm(req);
        const text = String(fields?.text ?? "").trim();

        const attachments: nodemailer.SendMailOptions["attachments"] = [];

        // iterate file fields safely
        for (const key of Object.keys(files || {})) {
            const fileOrFiles = files[key];
            if (!fileOrFiles) continue; // avoid undefined

            const candidates = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];

            for (const candidate of candidates) {
                // candidate may be a string or something else in edge cases — guard it
                if (!candidate || typeof candidate !== "object") continue;

                const file = candidate as FormidableFile;
                const filepath = String(file.filepath || "");
                const filename =
                    String(file.originalFilename ?? (file.newFilename as string) ?? "") ||
                    `attachment-${Date.now()}`;

                if (!filepath) continue; // no disk file to attach
                attachments.push({
                    filename,
                    content: fs.createReadStream(filepath),
                });
            }
        }

        // validate env
        const smtpUser = process.env.GMAIL_USER;
        const smtpPass = process.env.GMAIL_APP_PASSWORD;
        const target = process.env.GMAIL_TARGET || smtpUser;
        if (!smtpUser || !smtpPass) {
            console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in env.");
            return res.status(500).json({ error: "Missing mail credentials on server." });
        }

        // create transporter
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user: smtpUser, pass: smtpPass },
        });

        // verify transporter
        try {
            await transporter.verify();
            console.log("Nodemailer: SMTP verify OK");
        } catch (verifyErr) {
            console.error("Nodemailer verify failed:", verifyErr);
            return res.status(500).json({ error: "SMTP verification failed", details: String(verifyErr) });
        }

        const htmlBody = `
      <div style="font-family:system-ui, -apple-system, 'Segoe UI', Roboto, Arial; padding:16px;">
        <h2 style="color:#e63946;">🐞 New Bug Report</h2>
        <p><strong>Message:</strong></p>
        <div style="background:#f8f9fa;padding:10px;border-radius:6px;">
          ${text ? escapeHtml(text).replace(/\n/g, "<br/>") : "<em>(no message)</em>"}
        </div>
        <p style="font-size:12px;color:#666;margin-top:8px;">Sent from your app</p>
      </div>
    `;

        try {
            await transporter.sendMail({
                from: `"Bug Reporter" <${smtpUser}>`,
                to: target,
                subject: "🐞 New Bug Report with Attachments",
                html: htmlBody,
                attachments,
            });

            // cleanup temp files created by formidable
            cleanupTempFiles(files);

            return res.status(200).json({ success: true });
        } catch (sendErr) {
            console.error("Nodemailer send error:", sendErr);
            cleanupTempFiles(files);
            return res.status(500).json({ error: "Failed to send email", details: String(sendErr) });
        }
    } catch (err) {
        console.error("API error:", err);
        return res.status(500).json({ error: "Failed to process request", details: String(err) });
    }
}
