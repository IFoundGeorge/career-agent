import mongoose from "mongoose";

const AIAnalysisSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true, 
    },
    summary: {
      type: String,
    },
    fitScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    skills: [String],
    interviewQuestions: [String],
    analyzedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.AIAnalysis ||
  mongoose.model("AIAnalysis", AIAnalysisSchema);
