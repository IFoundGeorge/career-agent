import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    resumeText: {
      type: String,
    },
    resumeFileLink: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "completed", "failed"], // Added "failed"
      default: "uploaded",
    },
    // --- NEW ANALYSIS SECTION ---
    aiAnalysis: {
      summary: {
        type: String,
        default: "",
      },
      qualificationStatus: {
        type: String,
        enum: ["PASS", "FAIL"],
        default: "FAIL",
      },
      fitScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      skills: {
        type: [String],
        default: [],
      },
      interviewQuestions: {
        type: [String],
        default: [],
      },
      analyzedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true, // This adds both createdAt and updatedAt
  }
);

export default mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);