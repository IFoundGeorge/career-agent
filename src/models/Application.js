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
