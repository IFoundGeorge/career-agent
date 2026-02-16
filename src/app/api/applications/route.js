import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { UTApi } from "uploadthing/server";

export const runtime = "nodejs";

export async function POST(req) {
  let application = null;

  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get("resume");

    if (!file) {
      return NextResponse.json(
        { error: "No resume uploaded" },
        { status: 400 }
      );
    }

    // =========================
    // CONVERT FILE TO BUFFER
    // =========================
    const buffer = Buffer.from(await file.arrayBuffer());

    // =========================
    // UPLOAD TO UPLOADTHING
    // =========================
    const ut = new UTApi({
      apiKey: process.env.UPLOADTHING_SECRET,
    });

    const uploadResponse = await ut.uploadFiles([
      new File([buffer], file.name, { type: file.type }),
    ]);

    const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;

    if (!fileUrl) {
      throw new Error("UploadThing did not return file URL");
    }

    // =========================
    // EXTRACT NAME FROM FILE NAME
    // =========================
    const originalName = file.name.replace(/\.[^/.]+$/, "");
    const extractedFullName =
      originalName
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Unknown Applicant";

    // =========================
    // CREATE INITIAL RECORD
    // =========================
    application = await Application.create({
      fullName: extractedFullName,
      email: "",
      resumeText: "",
      resumeFileLink: fileUrl,
      status: "uploaded",
    });

    // =========================
    // UPDATE STATUS → PROCESSING
    // =========================
    application.status = "processing";
    await application.save();

    // =========================
    // PARSE PDF
    // =========================
    const resumeTextRaw = await new Promise((resolve, reject) => {
      let text = "";

      new PdfReader().parseBuffer(buffer, (err, item) => {
        if (err) reject(err);
        else if (!item) resolve(text);
        else if (item.text) text += item.text + " ";
      });
    });

    if (!resumeTextRaw || resumeTextRaw.trim() === "") {
      throw new Error("No parsed text returned from PDF");
    }

    // =========================
    // CLEAN TEXT (FIX SPACED EMAILS)
    // =========================
    const cleanedText = resumeTextRaw
      .replace(/\r?\n/g, " ")
      .replace(/([a-zA-Z0-9])\s+(?=[a-zA-Z0-9@.])/g, "$1")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".")
      .replace(/\s+/g, " ")
      .trim();

    // =========================
    // EXTRACT EMAIL
    // =========================
    const emailRegex =
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;

    const extractedEmail =
      cleanedText.match(emailRegex)?.[0] || "no-email-found";

    // =========================
    // FINAL UPDATE → ANALYZED
    // =========================
    application.email = extractedEmail;
    application.resumeText = cleanedText;
    application.status = "analyzed";
    await application.save();

    return NextResponse.json({
      success: true,
      applicationId: application._id,
      fullName: application.fullName,
      email: application.email,
      status: application.status,
      resumeFileLink: application.resumeFileLink,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    // If record exists → mark as failed
    if (application) {
      application.status = "failed";
      await application.save();
    }

    return NextResponse.json(
      { error: "Failed to process application", details: err.message },
      { status: 500 }
    );
  }
export async function GET() {
    try {
        await connectDB();
        const applications = await Application.find().sort({ createdAt: -1 });
        return NextResponse.json({ success: true, applications });
    } catch (err) {
        console.error("GET ERROR:", err);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}

export async function POST(req) {
    await connectDB();

    try {
        const results = [];
        const contentType = req.headers.get("content-type") || "";

        // -----------------------
        // PHASE 3: Workato updates
        // -----------------------
        if (contentType.includes("application/json")) {
            const data = await req.json();
            const { applicationId, fullName, email, resumeFileLink, resumeText, status } = data;

            if (!applicationId) {
                return NextResponse.json({ success: false, error: "Missing applicationId" }, { status: 400 });
            }

            const application = await Application.findById(applicationId);
            if (!application) {
                return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
            }

            // Update only fields sent by Workato
            application.fullName = fullName || application.fullName;
            application.email = email || application.email;
            application.resumeFileLink = resumeFileLink || application.resumeFileLink;
            application.resumeText = resumeText || application.resumeText;

            // Update status only if Workato sends it
            if (status) {
                application.status = status; // should be "analyzed"
            }

            await application.save();

            return NextResponse.json({ success: true, application });
        }

        // -----------------------
        // PHASE 1/2: Upload + parse resumes
        // -----------------------
        const formData = await req.formData();
        const files = formData.getAll("resume");

        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, error: "No resumes uploaded" }, { status: 400 });
        }

        const ut = new UTApi({ apiKey: process.env.UPLOADTHING_SECRET });
        const workatoWebhookUrl = process.env.WORKATO_URL;

        for (const file of files) {
            let application = null;

            try {
                const buffer = Buffer.from(await file.arrayBuffer());

                // Upload to UploadThing
                const uploadResponse = await ut.uploadFiles([new File([buffer], file.name, { type: file.type })]);
                const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;
                if (!fileUrl) throw new Error("Upload failed");

                // Extract name from filename
                const originalName = file.name.replace(/\.[^/.]+$/, "");
                const extractedFullName = originalName.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim() || "Unknown Applicant";

                // Create DB record with status = "processing"
                application = await Application.create({
                    fullName: extractedFullName,
                    email: "",
                    resumeText: "",
                    resumeFileLink: fileUrl,
                    status: "processing",
                });

                // Parse PDF
                const resumeTextRaw = await new Promise((resolve, reject) => {
                    let text = "";
                    new PdfReader().parseBuffer(buffer, (err, item) => {
                        if (err) reject(err);
                        else if (!item) resolve(text);
                        else if (item.text) text += item.text + " ";
                    });
                });

                if (!resumeTextRaw || resumeTextRaw.trim() === "") throw new Error("No parsed text returned");

                const cleanedText = resumeTextRaw
                    .replace(/\r?\n/g, " ")
                    .replace(/([a-zA-Z0-9])\s+(?=[a-zA-Z0-9@.])/g, "$1")
                    .replace(/\s*@\s*/g, "@")
                    .replace(/\s*\.\s*/g, ".")
                    .replace(/\s+/g, " ")
                    .trim();

                const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
                const extractedEmail = cleanedText.match(emailRegex)?.[0] || "no-email-found";

                // Update email and resumeText, leave status as "processing"
                application.email = extractedEmail;
                application.resumeText = cleanedText;
                await application.save();

                // Notify Workato webhook (does not change status)
                let workatoResponseText = null;
                const workatoPayload = {
                    applicationId: application._id,
                    fullName: application.fullName,
                    email: application.email,
                    resumeFileLink: application.resumeFileLink,
                    resumeText: application.resumeText,
                    status: application.status,
                };

                try {
                    const workatoResponse = await fetch(workatoWebhookUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${process.env.WORKATO_API}`
                        },
                        body: JSON.stringify(workatoPayload),
                    });
                    workatoResponseText = await workatoResponse.text();
                    console.log("[Workato] Sent payload:", workatoPayload);
                    console.log("[Workato] Response:", workatoResponseText);
                } catch (err) {
                    console.error("Failed to notify Workato:", err);
                }

                results.push({
                    success: true,
                    applicationId: application._id,
                    fullName: application.fullName,
                    email: application.email,
                    status: application.status,
                    resumeFileLink: application.resumeFileLink,
                    resumeText: application.resumeText,
                    workatoPayload,
                    workatoResponse: workatoResponseText,
                });
            } catch (fileError) {
                console.error("File error:", fileError);
                if (application) {
                    application.status = "failed";
                    await application.save();
                }
                results.push({
                    success: false,
                    fileName: file.name,
                    error: fileError.message,
                });
            }
        }

        return NextResponse.json({ success: true, totalProcessed: results.length, results });
    } catch (err) {
        console.error("SERVER ERROR:", err);
        return NextResponse.json({ success: false, error: "Batch processing failed", details: err.message }, { status: 500 });
    }
}