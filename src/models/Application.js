import mongoose from "mongoose";

const ApplicationSchema = new mongoose.Schema(
  {
    fileHash: {
    type: String,
    unique: true, // Prevents MongoDB from accepting duplicates
    required: true,
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
    },

    resumeFileLink: {   
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "completed"],
      default: "uploaded",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // ✅ adds createdAt
  }
);

export default mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);