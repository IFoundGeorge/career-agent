import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { UTApi } from "uploadthing/server";
import AIAnalysis from "@/models/AIAnalysis";
import crypto from "crypto";
import { createWorker } from 'tesseract.js'; 

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const applications = await Application.find().sort({ createdAt: -1 }).lean();
    const appsWithAnalysis = await Promise.all(
      applications.map(async (app) => {
        const analysis = await AIAnalysis.findOne({ applicationId: app._id });
        return { ...app, aiAnalysis: analysis };
      })
    );
    return NextResponse.json({ success: true, applications: appsWithAnalysis });
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

    // JSON updates (status updates)
    if (contentType.includes("application/json")) {
      const data = await req.json();
      const { applicationId, status, ...updates } = data;
      if (!applicationId)
        return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });

      const application = await Application.findByIdAndUpdate(
        applicationId,
        { ...updates, status },
        { new: true }
      );
      return NextResponse.json({ success: !!application, application });
    }

    // FormData (file uploads)
    const formData = await req.formData();
    const files = formData.getAll("resume");

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "No resumes uploaded" }, { status: 400 });
    }

    const ut = new UTApi({ apiKey: process.env.UPLOADTHING_SECRET });
    const workatoWebhookUrl = process.env.WORKATO_URL;

    for (const file of files) {
      if (file.type !== "application/pdf") {
        results.push({ success: false, fileName: file.name, error: "Only PDFs accepted." });
        continue;
      }

      let application = null;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        // Check duplicates
        const existingApp = await Application.findOne({ fileHash });
        if (existingApp) {
          results.push({ success: false, fileName: file.name, error: "Duplicate resume.", isDuplicate: true });
          continue;
        }

        // Upload file
        const uploadResponse = await ut.uploadFiles([new File([buffer], file.name, { type: file.type })]);
        const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;
        if (!fileUrl) throw new Error("Upload failed");

        // ✅ OCR.space API
        const ocrForm = new FormData();
        ocrForm.append("apikey", "K87360289988957"); // your free OCR.space key
        ocrForm.append("url", fileUrl);
        ocrForm.append("language", "eng");
        ocrForm.append("isOverlayRequired", "false");

        const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          body: ocrForm,
        });

        const ocrResult = await ocrResponse.json();
        const extractedText = ocrResult.ParsedResults?.[0]?.ParsedText || "";

        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error("OCR failed or PDF is unreadable.");
        }

        // Extract email from OCR text
        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
        const extractedEmail = extractedText.match(emailRegex)?.[0] || "no-email-found";

        // Save application
        application = await Application.create({
          fullName: file.name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, " ").trim(),
          email: extractedEmail,
          resumeText: extractedText,
          resumeFileLink: fileUrl,
          status: "processing",
          fileHash,
        });

        // Notify Workato
        const workatoResponse = await fetch(workatoWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-token": process.env.WORKATO_API,
          },
          body: JSON.stringify({
            applicationId: application._id,
            fullName: application.fullName,
            resumeText: application.resumeText,
            resumeFileLink: application.resumeFileLink,
          }),
        });

        const workatoResponseText = await workatoResponse.text();
        const outerJson = JSON.parse(workatoResponseText);

        if (outerJson && outerJson.summary) {
          const cleanJsonString = outerJson.summary.replace(/=>/g, ":");
          const aiData = JSON.parse(cleanJsonString);

          await AIAnalysis.create({
            applicationId: application._id,
            summary: aiData.summary || "",
            qualificationStatus: aiData.qualificationStatus || "FAIL",
            fitScore: Number(aiData.fitScore) || 0,
            skills: aiData.skills || [],
            interviewQuestions: aiData.interviewQuestions || [],
          });

          application.status = "analyzed";
          await application.save();
        }

        results.push({ success: true, fullName: application.fullName });

      } catch (err) {
        console.error("Processing error:", err);
        if (application) {
          application.status = "failed";
          await application.save();
        }
        results.push({ success: false, fileName: file.name, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}