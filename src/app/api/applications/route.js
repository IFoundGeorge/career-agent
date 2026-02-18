import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { UTApi } from "uploadthing/server";
import AIAnalysis from "@/models/AIAnalysis";
import crypto from "crypto"; // Required for file hashing

export const runtime = "nodejs";

/**
 * GET: Fetches all applications with their associated AI Analysis
 */
export async function GET() {
  try {
    await connectDB();
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .lean();

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

/**
 * POST: Handles both JSON updates and Multi-part Resume Uploads
 */
export async function POST(req) {
  await connectDB();

  try {
    const results = [];
    const contentType = req.headers.get("content-type") || "";

    // --- CASE 1: JSON DATA UPDATE ---
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

      application.fullName = fullName || application.fullName;
      application.email = email || application.email;
      application.resumeFileLink = resumeFileLink || application.resumeFileLink;
      application.resumeText = resumeText || application.resumeText;

      if (status) {
        application.status = status;
      }

      await application.save();
      return NextResponse.json({ success: true, application });
    }

    // --- CASE 2: FILE UPLOAD (RESUMES) ---
    const formData = await req.formData();
    const files = formData.getAll("resume");

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "No resumes uploaded" }, { status: 400 });
    }

    const ut = new UTApi({ apiKey: process.env.UPLOADTHING_SECRET });
    const workatoWebhookUrl = process.env.WORKATO_URL;

    for (const file of files) {
      // 1. Validate File Type (Server-side safety)
      if (file.type !== "application/pdf") {
        results.push({ 
          success: false, 
          fileName: file.name, 
          error: "Invalid file type. Only PDFs are accepted." 
        });
        continue;
      }

      let application = null;
      let workatoResponseText = null;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // 2. Generate Hash to prevent duplicates
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        // 3. Check if hash already exists in MongoDB
        const existingApp = await Application.findOne({ fileHash });
        if (existingApp) {
          results.push({
            success: false,
            fileName: file.name,
            error: "This resume has already been uploaded.",
            isDuplicate: true
          });
          continue; // Skip to the next file
        }

        // 4. Upload to UploadThing
        const uploadResponse = await ut.uploadFiles([new File([buffer], file.name, { type: file.type })]);
        const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;
        if (!fileUrl) throw new Error("Upload failed");

        const originalName = file.name.replace(/\.[^/.]+$/, "");
        const extractedFullName = originalName.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim() || "Unknown Applicant";

        // 5. Create Initial Application Record
        application = await Application.create({
          fullName: extractedFullName,
          email: "",
          resumeText: "",
          resumeFileLink: fileUrl,
          status: "failed",
          fileHash: fileHash, // Save hash to prevent future duplicates
        });

        // 6. Parse PDF Text
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

        application.email = extractedEmail;
        application.resumeText = cleanedText;
        await application.save();

        // 7. Notify Workato/AI for Analysis
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
              "api-token": process.env.WORKATO_API,
            },
            body: JSON.stringify(workatoPayload),
          });

          workatoResponseText = await workatoResponse.text();

          // 8. Parse AI Response and Save
          const outerJson = JSON.parse(workatoResponseText);
          const innerRubyString = outerJson.summary;
          const cleanJsonString = innerRubyString.replace(/=>/g, ":");
          const aiData = JSON.parse(cleanJsonString);

          const savedAnalysis = await AIAnalysis.create({
            applicationId: application._id,
            summary: aiData.summary || "",
            qualificationStatus: aiData.qualificationStatus || "FAIL",
            fitScore: Number(aiData.fitScore) || 0,
            skills: Array.isArray(aiData.skills) ? aiData.skills : [],
            interviewQuestions: Array.isArray(aiData.interviewQuestions) ? aiData.interviewQuestions : [],
          });

          console.log("-----------------------------------------");
          console.log("✅ DUPLICATE CHECK PASSED & ANALYSIS SAVED");
          console.log("Application:", application.fullName);
          console.log("Score:", savedAnalysis.fitScore);
          console.log("-----------------------------------------");

          application.status = "analyzed";
          await application.save();

        } catch (err) {
          console.error("❌ Analysis stage failed:", err);
        }

        results.push({
          success: true,
          applicationId: application._id,
          fullName: application.fullName,
          email: application.email,
          status: application.status,
          resumeFileLink: application.resumeFileLink,
        });

      } catch (fileError) {
        console.error("File error:", fileError);
        if (application) {
          application.status = "Failed";
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