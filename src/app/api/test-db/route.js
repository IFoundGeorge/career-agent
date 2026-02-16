import connectDB from "@/lib/mongodb";
import Application from "@/models/Application";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("👉 Connecting to MongoDB...");
    await connectDB();

    const doc = await Application.create({
      fullName: "Test User",
      email: "test@example.com",
      resumeFilePath: "/uploads/test.pdf",
      status: "uploaded", // 
    });

    return NextResponse.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    console.error("❌ Mongo error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
