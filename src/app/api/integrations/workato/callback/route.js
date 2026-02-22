import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";

export const runtime = "nodejs";

/**
 * Workato callback handler
 * Receives analysis results from Workato and updates the corresponding application
 */
export async function POST(req) {
    try {
        await connectDB();

        // Verify Workato API token
        const apiToken = req.headers.get("api-token");
        if (apiToken !== process.env.WORKATO_API) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { applicationId, analysis, status } = body;

        if (!applicationId) {
            return NextResponse.json(
                { success: false, error: "Missing applicationId" },
                { status: 400 }
            );
        }

        // Find and update the application
        const application = await Application.findById(applicationId);
        if (!application) {
            return NextResponse.json(
                { success: false, error: "Application not found" },
                { status: 404 }
            );
        }

        // Update with Workato analysis results
        if (analysis) {
            application.aiAnalysis = analysis;
        }

        // Update status if provided
        if (status) {
            application.status = status; // e.g., "analyzed", "reviewed"
        }

        await application.save();

        console.log(`[Workato Callback] Updated application ${applicationId}`);

        return NextResponse.json({
            success: true,
            message: "Application updated successfully",
            application
        });
    } catch (err) {
        console.error("[Workato Callback] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}

/**
 * Health check endpoint for Workato
 */
export async function GET() {
    return NextResponse.json({
        success: true,
        message: "Workato callback endpoint is ready"
    });
}