import mongoose from "mongoose";

const AIAnalysisSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true,
    },
    disclaimer: {
      type: String,
      default: "ADVISORY ONLY. This is an AI-generated preliminary screen. A qualified recruiter must review this output before any recruitment decision is made.",
    },
    summary: {
      type: String,
      default: "",
    },
    // CHANGED: qualificationStatus → preliminaryScreeningIndicator
    preliminaryScreeningIndicator: {
      type: String,
      enum: ["PROGRESSED", "FURTHER REVIEW NEEDED"],
      default: "FURTHER REVIEW NEEDED",
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
    // NEW: Add identifiedGaps field
    identifiedGaps: {
      type: [String],
      default: [],
    },
    interviewQuestions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING", // Changed from FAILED to PENDING for new analyses
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.AIAnalysis || 
  mongoose.model("AIAnalysis", AIAnalysisSchema);