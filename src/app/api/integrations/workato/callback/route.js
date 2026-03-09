import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import AIAnalysis from "@/models/AIAnalysis";

export const runtime = "nodejs";

export async function POST(req) {
    try {
        // Connect to DB
        await connectDB();

        // --- DEBUG: Log headers ---
        const apiToken = req.headers.get("api-token");
        console.log("[Workato Callback] Received api-token:", apiToken);

        // Verify API token
        if (!apiToken || apiToken !== process.env.WORKATO_API) {
            console.error("[Workato Callback] Unauthorized access attempt");
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        // --- Parse JSON safely ---
        let body;
        try {
            body = await req.json();
        } catch (parseErr) {
            console.error("[Workato Callback] Failed to parse JSON:", parseErr);
            return NextResponse.json(
                { success: false, error: "Invalid JSON payload" },
                { status: 400 }
            );
        }

        console.log("[Workato Callback] Received body:", body);

        const { applicationId, analysis, status } = body;

        if (!applicationId) {
            return NextResponse.json(
                { success: false, error: "Missing applicationId" },
                { status: 400 }
            );
        }

        const application = await Application.findById(applicationId);
        if (!application) {
            return NextResponse.json(
                { success: false, error: "Application not found" },
                { status: 404 }
            );
        }

        // --- Save AI Analysis ---
        if (analysis) {
            try {
                await AIAnalysis.findOneAndUpdate(
                    { applicationId },
                    {
                        disclaimer: analysis.disclaimer || "",
                        summary: analysis.summary || "",
                        preliminaryScreeningIndicator: analysis.preliminaryScreeningIndicator || "",
                        fitScore: analysis.fitScore || 0,
                        skills: analysis.skills || [],
                        identifiedGaps: analysis.identifiedGaps || [],
                        interviewQuestions: analysis.interviewQuestions || [],
                        status: "SUCCESS",
                        analyzedAt: new Date(),
                    },
                    { upsert: true, new: true }
                );

                application.aiAnalysis = {
                    preliminaryScreeningIndicator: analysis.preliminaryScreeningIndicator || "",
                    fitScore: analysis.fitScore || 0,
                    summary: analysis.summary || "",
                };
            } catch (analysisErr) {
                console.error("[Workato Callback] Failed to save AI analysis:", analysisErr);
                return NextResponse.json(
                    { success: false, error: "Failed to save AI analysis" },
                    { status: 500 }
                );
            }
        }

        if (status) {
            application.status = status;
        }

        await application.save();

        console.log(`[Workato Callback] Updated application ${applicationId} successfully`);

        return NextResponse.json({
            success: true,
            message: "Application updated successfully",
            application
        });

    } catch (err) {
        console.error("[Workato Callback] Unexpected Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: "Workato callback endpoint is ready"
    });
}