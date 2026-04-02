// models/JobConfig.js
import mongoose from "mongoose";

const JobConfigSchema = new mongoose.Schema(
  {
    jobTitle: String,
    jobDescription: String,
  },
  { timestamps: true }
);

export default mongoose.models.JobConfig || mongoose.model("JobConfig", JobConfigSchema);