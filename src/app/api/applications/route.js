import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { UTApi } from "uploadthing/server";
import AIAnalysis from "@/models/AIAnalysis";
import crypto from "crypto";

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

        // OCR.space API
        const ocrForm = new FormData();
        ocrForm.append("apikey", "K87360289988957");
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
            jobTitle: process.env.DEFAULT_JOB_TITLE || "Software Engineer",
            jobRequirements: process.env.DEFAULT_JOB_REQUIREMENTS || "",
          }),
        });

        const workatoResponseText = await workatoResponse.text();
        
        // DEBUG: Log raw response
        console.log("[Workato Raw Response]:", workatoResponseText.substring(0, 500));
        
        const outerJson = JSON.parse(workatoResponseText);

        // UPDATED: Handle new schema fields from Workato
        if (outerJson && outerJson.summary) {
          // FIX: Replace Ruby syntax with JSON syntax
          const cleanJsonString = outerJson.summary
            .replace(/=>/g, ":")           // Ruby hash rockets to JSON colons
            .replace(/\bnil\b/g, "null");  // Ruby nil to JSON null

          let aiData;
          try {
            aiData = JSON.parse(cleanJsonString);
          } catch (parseErr) {
            console.error("JSON Parse Error:", parseErr.message);
            console.error("Cleaned string:", cleanJsonString.substring(0, 200));
            throw new Error("Failed to parse AI response: " + parseErr.message);
          }

          // DEBUG: Check what fitScore we received
          console.log("[AI fitScore raw]:", aiData.fitScore, "type:", typeof aiData.fitScore);
          console.log("[AI all keys]:", Object.keys(aiData));

          // FIX: Handle fitScore - check multiple possible field names and calculate if missing
          let fitScore = Number(aiData.fitScore ?? aiData.fit_score ?? aiData.FitScore ?? 0);
          
          // If still 0 or invalid, calculate based on skills
          if (!fitScore || fitScore === 0) {
            const skillCount = aiData.skills?.length || 0;
            // Base 40 + 10 per skill, max 95
            fitScore = Math.min(40 + (skillCount * 10), 95);
            console.log(`[Calculated fitScore]: ${fitScore} based on ${skillCount} skills`);
          } else {
            console.log(`[Using AI fitScore]: ${fitScore}`);
          }

          // NEW SCHEMA: Map to updated AIAnalysis fields
          await AIAnalysis.create({
            applicationId: application._id,
            disclaimer: aiData.disclaimer || "ADVISORY ONLY. This is an AI-generated preliminary screen. A qualified recruiter must review this output before any recruitment decision is made.",
            summary: aiData.summary || "",
            preliminaryScreeningIndicator: aiData.preliminaryScreeningIndicator || "FURTHER REVIEW NEEDED",
            fitScore: fitScore, // Use the calculated or received score
            skills: aiData.skills || [],
            identifiedGaps: aiData.identifiedGaps || [],
            interviewQuestions: aiData.interviewQuestions || [],
            status: "SUCCESS", // <-- ADD THIS LINE
          });

          application.status = "analyzed";
          await application.save();
        } else {
          // Handle case where Workato response doesn't have summary
          console.error("Workato response missing summary:", outerJson);
          throw new Error("AI analysis failed: " + (outerJson?.message || "No summary in response"));
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