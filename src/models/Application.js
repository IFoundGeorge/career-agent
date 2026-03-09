import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    fileHash: {
      type: String,
      unique: true, // Prevent duplicates
      required: true,
      trim: true,
    },
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
      required: true, // Make required for AI analysis
      trim: true,
      validate: {
        validator: function (v) {
          return v && v.length > 50; // ensure non-empty meaningful text
        },
        message: "resumeText must contain actual text",
      },
    },
    resumeFileLink: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "completed", "failed"],
      default: "uploaded",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);