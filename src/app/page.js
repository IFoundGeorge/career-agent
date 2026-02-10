"use client";

import { useState, useEffect } from "react";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/* ---------------- Skeleton ---------------- */

function UploadSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 animate-pulse">
      <div className="flex w-full max-w-5xl gap-10 rounded-2xl border bg-white p-8 shadow-md">
        <div className="w-1/2 rounded-xl border-2 border-dashed bg-zinc-100 p-10 flex flex-col items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-zinc-300 mb-4" />
          <div className="h-8 w-32 rounded-full bg-zinc-300 mb-3" />
          <div className="h-4 w-40 rounded bg-zinc-200" />
        </div>

        <div className="w-px bg-zinc-200" />

        <div className="w-1/2 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-zinc-100 border" />
          ))}
          <div className="mt-6 h-12 w-full rounded-full bg-zinc-300" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function Page() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setInitialLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  if (initialLoading) return <UploadSkeleton />;

  function showToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

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
    setFiles((prev) => {
      const existing = new Set(
        prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`)
      );

      const valid = [];

      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          showToast(error, "error");
          continue;
        }

        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existing.has(key)) {
          showToast(`${file.name} already added`, "error");
          continue;
        }

        existing.add(key);
        valid.push(file);
      }

      return [...prev, ...valid];
    });
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleFileChange(e) {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!files.length) return;

    setLoading(true);
    setProgress(0);
    setParsed(null);

    const fd = new FormData();
    fd.append("file", files[0]);

    const timer = setInterval(() => {
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
      clearInterval(timer);
      setProgress(100);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-lg">
          <h2 className="text-2xl font-semibold">Resume Processed</h2>

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
            className="mt-6 rounded-full bg-zinc-900 px-6 py-2 text-sm text-white"
          >
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100">
      <div
        className={`relative flex w-full max-w-5xl gap-10 rounded-2xl border bg-white p-8 pt-16 shadow-md
        ${dragActive ? "border-blue-500" : "border-zinc-300"}`}
      >

        {/* -------- Folder summary bar -------- */}
        <div className="absolute -top-20 left-0 right-0 flex gap-4 px-8">
          {[
            { title: "Files", count: "118 files", size: "2.8 GB" },
            { title: "", count: "16 files", size: "128.1 TB" },
            { title: "", count: "1,228 files", size: "155 MB" },
          ].map((item) => (
            <div
              key={item.title}
              className="flex-1 rounded-xl border bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  📁
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-zinc-500">
                    {item.count} · {item.size}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {toast && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 rounded-lg bg-black px-4 py-2 text-sm text-white">
            {toast.message}
          </div>
        )}

        {/* -------- Upload area -------- */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`relative flex w-1/2 flex-col items-center justify-center rounded-xl border-2 border-dashed p-10
          ${dragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300 bg-zinc-50"}`}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          <Upload className="mb-4 h-10 w-10 text-blue-500" />
          <button className="rounded-full bg-blue-500 px-6 py-2 text-sm text-white">
            Browse
          </button>
          <p className="mt-3 text-sm text-zinc-500">Drop a file here</p>
        </div>

        <div className="w-px bg-zinc-200" />

        {/* -------- File list -------- */}
        <div className="w-1/2 space-y-3">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
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

          {loading && (
            <div>
              <div className="h-2 rounded-full bg-zinc-200">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Uploading… {progress}%
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!files.length || loading}
            className="mt-4 h-12 w-full rounded-full bg-blue-500 text-white disabled:opacity-50"
          >
            {loading ? "Processing…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
