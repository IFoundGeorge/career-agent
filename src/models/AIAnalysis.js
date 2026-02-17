import mongoose from "mongoose";

const AIAnalysisSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true, // One analysis per application
    },
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
  {
    timestamps: true,
  }
);

export default mongoose.models.AIAnalysis || 
  mongoose.model("AIAnalysis", AIAnalysisSchema);