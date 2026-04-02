import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import JobConfig from "@/models/JobConfig";

export async function GET() {
  await connectDB();

  const latest = await JobConfig.findOne().sort({ createdAt: -1 });

  return NextResponse.json({ success: true, job: latest });
}

export async function POST(req) {
  await connectDB();

  const { jobTitle, jobDescription } = await req.json();

  const job = await JobConfig.create({ jobTitle, jobDescription });

  return NextResponse.json({ success: true, job });
}