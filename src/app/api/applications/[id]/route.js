import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import AIAnalysis from "@/models/AIAnalysis";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi(); 

export async function POST(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    // Find the analysis by applicationId
    const analysisData = await AIAnalysis.findOne({ applicationId: id });

    if (!analysisData) {
      console.log("No analysis found for ID:", id);
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Send back the whole document so fitScore, summary, etc. are available
    return NextResponse.json({ 
      success: true, 
      analysis: analysisData 
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// --- DELETE: REMOVE APP, FILE, AND ANALYSIS ---
export async function DELETE(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const app = await Application.findById(id);
    if (!app) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    const fileUrl = app.resumeFileLink || app.resumeUrl || app.url;

    if (fileUrl) {
      const fileKey = fileUrl.split("/").pop();
      if (fileKey) {
          console.log("Deleting from UploadThing:", fileKey);
          await utapi.deleteFiles(fileKey);
      }
    }

    // Clean up both the analysis and the application from MongoDB
    await AIAnalysis.deleteMany({ applicationId: id });
    await app.deleteOne();

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    return NextResponse.json({ success: false, error: "Deletion failed." }, { status: 500 });
  }
}

// --- GET: FETCH SINGLE APP ---
export async function GET(req, { params }) {
    await connectDB();
    const { id } = await params;
    const app = await Application.findById(id);
    if (!app) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, application: app });
}