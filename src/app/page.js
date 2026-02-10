"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB (industry-safe default)
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export default function Page() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [parsed, setParsed] = useState(null);

  /* ---------------- Toast ---------------- */

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  /* ---------------- Validation ---------------- */

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: invalid file type`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: exceeds 10MB`;
    }
    return null;
  }

  function addFiles(newFiles) {
    const valid = [];
    for (const file of newFiles) {
      const err = validateFile(file);
      if (err) {
        showToast(err, "error");
        continue;
      }
      valid.push(file);
    }
    if (valid.length) setFiles((prev) => [...prev, ...valid]);
  }

  /* ---------------- Drag & Drop ---------------- */

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles([...e.dataTransfer.files]);
  }

  function handleFileChange(e) {
    addFiles([...e.target.files]);
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /* ---------------- Submit + Parse ---------------- */

  async function handleSubmit() {
    if (!files.length) return;

    setLoading(true);
    setProgress(10);
    setParsed(null);

    const fd = new FormData();
    fd.append("file", files[0]);

    const progressTimer = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 200);

    try {
      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      setParsed(data.parsed);
      setSuccess(true);
      showToast("Resume parsed successfully!");
    } catch {
      showToast("Upload failed", "error");
    } finally {
      clearInterval(progressTimer);
      setProgress(100);
      setLoading(false);
    }
  }

  /* ---------------- Success ---------------- */

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <h2 className="text-2xl font-semibold animate-pulse">
            ✅ Resume Processed
          </h2>

          {parsed && (
            <div className="mt-6 rounded-xl bg-zinc-100 p-4 text-left text-sm">
              <p><strong>Email:</strong> {parsed.email || "—"}</p>
              <p><strong>Phone:</strong> {parsed.phone || "—"}</p>
              <p><strong>Skills:</strong> {parsed.skills?.join(", ") || "—"}</p>
            </div>
          )}

          <button
            onClick={() => {
              setFiles([]);
              setParsed(null);
              setSuccess(false);
              setProgress(0);
            }}
            className="mt-6 rounded-full bg-zinc-900 px-6 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Main UI ---------------- */

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      <div
        className={`relative flex w-full max-w-5xl gap-10 rounded-2xl border bg-white p-8 shadow-md transition-all duration-300
          ${dragActive
            ? "border-blue-500 shadow-blue-200/50"
            : "border-zinc-300"}`}
      >

        {/* Toast */}
        {toast && (
          <div
            className={`absolute -top-14 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow
              ${toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-black text-white"}`}
          >
            {toast.message}
          </div>
        )}

        {/* Upload box */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative flex w-1/2 flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300
            ${dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-zinc-300 bg-zinc-50"}`}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          <Upload className="mb-4 h-10 w-10 text-blue-500" />

          <button
            type="button"
            className="rounded-full bg-blue-500 px-6 py-2 text-sm font-medium text-white"
          >
            Browse
          </button>

          <p className="mt-3 text-sm text-zinc-500">
            drop a file here
          </p>

          <p className="mt-1 text-xs text-red-500">
            *File supported .pdf, .doc & .docx
          </p>
        </div>

        {/* Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-zinc-300 to-transparent" />

        {/* File list */}
        <div className="w-1/2 space-y-3">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <span className="truncate">
                {file.name}
                <span className="ml-2 text-xs text-zinc-400">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </span>

              <button
                onClick={() => removeFile(i)}
                className="text-zinc-400 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Progress */}
          {loading && (
            <div className="pt-2">
              <div className="h-2 rounded-full bg-zinc-200">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Uploading… {progress}%
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!files.length || loading}
            className="mt-4 h-12 w-full rounded-full bg-blue-500 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Processing…" : "Submit"}
          </button>
        </div>

      </div>
    </div>
  );
}
