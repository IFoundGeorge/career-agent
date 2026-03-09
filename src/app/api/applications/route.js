import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import AIAnalysis from "@/models/AIAnalysis";
import { UTApi } from "uploadthing/server";
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
  const results = [];

  try {
    const contentType = req.headers.get("content-type") || "";

    // 1️⃣ Handle JSON status updates
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

    // 2️⃣ Handle PDF uploads via FormData
    const formData = await req.formData();
    const files = formData.getAll("resume");
    if (!files || files.length === 0)
      return NextResponse.json({ success: false, error: "No resumes uploaded" }, { status: 400 });

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

        // ✅ Check for duplicates
        const existingApp = await Application.findOne({ fileHash });
        if (existingApp) {
          results.push({ success: false, fileName: file.name, error: "Duplicate resume.", isDuplicate: true });
          continue;
        }

        // ✅ Upload file to UploadThing
        const uploadResponse = await ut.uploadFiles([new File([buffer], file.name, { type: file.type })]);
        const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;
        if (!fileUrl) throw new Error("Upload failed");

        // ✅ OCR.space API
        const ocrForm = new FormData();
        ocrForm.append("apikey", process.env.OCR_SPACE_KEY);
        ocrForm.append("url", fileUrl);
        ocrForm.append("language", "eng");
        ocrForm.append("isOverlayRequired", "false");

        const ocrResponse = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: ocrForm });
        const ocrResult = await ocrResponse.json();
        let extractedText = (ocrResult.ParsedResults?.[0]?.ParsedText || "").trim();
        if (!extractedText || extractedText.length < 10) throw new Error("OCR failed or PDF unreadable.");

        // ✅ Clean extracted text
        extractedText = extractedText
          .replace(/\n/g, " ")
          .replace(/\s{2,}/g, " ")
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/\*|_/g, "")
          .replace(/Mith|Sen-ed|fmrn|ALIM/g, "")
          .trim();

        // ✅ Extract email
        const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
        const extractedEmail = extractedText.match(emailRegex)?.[0] || "no-email-found";

        // ✅ Save application with status = processing
        application = await Application.create({
          fullName: file.name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, " ").trim(),
          email: extractedEmail,
          resumeText: extractedText,
          resumeFileLink: fileUrl,
          status: "processing",
          fileHash,
        });

        // ✅ Notify Workato
        const workatoResponse = await fetch(workatoWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-token": process.env.WORKATO_API },
          body: JSON.stringify({
            applicationId: application._id,
            fullName: application.fullName,
            resumeText: extractedText,
            resumeFileLink: fileUrl,
            jobTitle: process.env.DEFAULT_JOB_TITLE || "Software Engineer",
            jobRequirements: process.env.DEFAULT_JOB_REQUIREMENTS || "",
          }),
        });

        const workatoResponseText = await workatoResponse.text();
        console.log("[Workato Raw Response]:", workatoResponseText.substring(0, 500));

        const outerJson = JSON.parse(workatoResponseText);

        // ✅ Handle AI Analysis
        if (outerJson?.summary) {
          const cleanJsonString = outerJson.summary.replace(/=>/g, ":").replace(/\bnil\b/g, "null");
          let aiData;
          try {
            aiData = JSON.parse(cleanJsonString);
          } catch (parseErr) {
            console.error("JSON Parse Error:", parseErr.message, "String:", cleanJsonString.substring(0, 200));
            throw new Error("Failed to parse AI response");
          }

          let fitScore = Number(aiData.fitScore ?? aiData.fit_score ?? aiData.FitScore ?? 0);
          if (!fitScore || fitScore === 0) {
            const skillCount = aiData.skills?.length || 0;
            fitScore = Math.min(40 + skillCount * 10, 95);
          }

          await AIAnalysis.create({
            applicationId: application._id,
            disclaimer: aiData.disclaimer || "ADVISORY ONLY. This is AI-generated preliminary screen.",
            summary: aiData.summary || "",
            preliminaryScreeningIndicator: aiData.preliminaryScreeningIndicator || "FURTHER REVIEW NEEDED",
            fitScore,
            skills: aiData.skills || [],
            identifiedGaps: aiData.identifiedGaps || [],
            interviewQuestions: aiData.interviewQuestions || [],
          });

          application.status = "analyzed";
          await application.save();
        } else {
          console.error("Workato response missing summary:", outerJson);
          throw new Error("AI analysis failed");
        }

        // ✅ Push successful result
        results.push({
          success: true,
          applicationId: application._id,
          fullName: application.fullName,
          email: application.email,
          status: application.status,
          resumeFileLink: application.resumeFileLink,
          resumeText: application.resumeText,
        });

      } catch (err) {
        console.error("File error:", err);
        if (application) {
          application.status = "failed";
          await application.save();
        }
        results.push({ success: false, fileName: file.name, error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("POST ERROR:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}