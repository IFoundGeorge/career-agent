import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import AIAnalysis from "@/models/AIAnalysis";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi(); 

export async function PATCH(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const body = await req.json();
    const updatedApp = await Application.findByIdAndUpdate(id, body, { new: true });

    if (!updatedApp) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json(updatedApp);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// FIXED: Changed from POST to GET - POST doesn't make sense for fetching data
export async function GET(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    // Get application
    const application = await Application.findById(id);
    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    // Get analysis (might be null if not processed yet)
    const analysisData = await AIAnalysis.findOne({ applicationId: id });

    if (!analysisData) {
      console.log("No analysis found for ID:", id);
      // Return 200 with null analysis instead of 404 error
      return NextResponse.json({ 
        success: true, 
        application: application,
        analysis: null,
        message: "Analysis not yet available"
      });
    }

    return NextResponse.json({ 
      success: true, 
      application: application,
      analysis: analysisData 
    });
  } catch (err) {
    console.error("GET Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Keep POST only if frontend specifically uses POST (but it should use GET)
// If you must keep POST for backward compatibility:
export async function POST(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    // Get the application first
    const application = await Application.findById(id);
    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
    }

    // Find the analysis by applicationId
    const analysisData = await AIAnalysis.findOne({ applicationId: id });

    if (!analysisData) {
      console.log("No analysis found for ID:", id);
      // Return 200 with application data but null analysis
      return NextResponse.json({ 
        success: true,  // Changed to true so frontend doesn't crash
        application: application,
        analysis: null,
        status: application.status, // "processing", "failed", or "analyzed"
        message: application.status === "processing" ? "Analysis in progress" : "Analysis failed or not available"
      });
    }

    // Send back the whole document so fitScore, summary, etc. are available
    return NextResponse.json({ 
      success: true, 
      application: application,
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

    await AIAnalysis.deleteMany({ applicationId: id });
    await app.deleteOne();

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    return NextResponse.json({ success: false, error: "Deletion failed." }, { status: 500 });
  }
}