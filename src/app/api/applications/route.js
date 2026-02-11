/* Import necessary modules and libraries
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import dbConnect from "@/lib/dbConnect";
import Application from "@/models/Application";

// Post Request Handler for processing job applications
export async function POST(request) {
  try {
    // Connect to DB
    await dbConnect();

    // Read form data
    const formData = await request.formData();
    const file = formData.get("resume");
    const fullName = formData.get("fullName");
    const email = formData.get("email");

    // Error handling for missing fields
    if (!file) {
      return NextResponse.json(
        { error: "Resume file is required" },
        { status: 400 }
      );
    }

    // Save file to /uploads
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    const filePath = path.join(uploadDir, file.name);
    fs.writeFileSync(filePath, buffer);

    // Create initial MongoDB record
    const application = await Application.create({
      fullName,
      email,
      resumeFilePath: filePath,
      status: "uploaded",
    });

    // Update status to processing
    application.status = "processing";
    await application.save();

    // Convert PDF → text
    const parsed = await pdfParse(buffer);
    const resumeText = parsed.text;

    // AI processing will happen here later

    // Final status update
    application.status = "analyzed";
    await application.save();

    return NextResponse.json({
      success: true,
      applicationId: application._id,
    });
  } catch (error) { //Last catch block to handle any errors that occur during the process
    console.error(error);
    return NextResponse.json(
      { error: "Failed to process application" },
      { status: 500 }
    );
  }
}*/
import { NextResponse } from "next/server";
import { PdfReader } from "pdfreader";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { UTApi } from "uploadthing/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();

    const applications = await Application.find().sort({ createdAt: -1 });

    return Response.json({
      success: true,
      applications,
    });
  } catch (err) {
    console.error("GET ERROR:", err);
    return Response.json({ success: false }, { status: 500 });
  }
}

export async function POST(req) {
  await connectDB();

  const results = [];

  try {
    const formData = await req.formData();
    const files = formData.getAll("resume"); // 🔥 MULTIPLE FILES

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No resumes uploaded" },
        { status: 400 }
      );
    }

    const ut = new UTApi({
      apiKey: process.env.UPLOADTHING_SECRET,
    });

    // 🔥 PROCESS EACH FILE
    for (const file of files) {
      let application = null;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // Upload to UploadThing
        const uploadResponse = await ut.uploadFiles([
          new File([buffer], file.name, { type: file.type }),
        ]);

        const fileUrl = uploadResponse?.[0]?.data?.ufsUrl;

        if (!fileUrl) {
          throw new Error("Upload failed");
        }

        // Extract name from filename
        const originalName = file.name.replace(/\.[^/.]+$/, "");
        const extractedFullName =
          originalName
            .replace(/[_\-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim() || "Unknown Applicant";

        // Create DB record
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

        if (!resumeTextRaw || resumeTextRaw.trim() === "") {
          throw new Error("No parsed text returned");
        }

        const cleanedText = resumeTextRaw
          .replace(/\r?\n/g, " ")
          .replace(/([a-zA-Z0-9])\s+(?=[a-zA-Z0-9@.])/g, "$1")
          .replace(/\s*@\s*/g, "@")
          .replace(/\s*\.\s*/g, ".")
          .replace(/\s+/g, " ")
          .trim();

        const emailRegex =
          /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;

        const extractedEmail =
          cleanedText.match(emailRegex)?.[0] || "no-email-found";

        application.email = extractedEmail;
        application.resumeText = cleanedText;
        application.status = "analyzed";
        await application.save();

        results.push({
          success: true,
          applicationId: application._id,
          fullName: application.fullName,
          email: application.email,
          status: application.status,
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

    return NextResponse.json({
      success: true,
      totalProcessed: results.length,
      results
    });


  } catch (err) {
    console.error("SERVER ERROR:", err);

    return NextResponse.json(
      { error: "Batch processing failed", details: err.message },
      { status: 500 }
    );
  }
}
