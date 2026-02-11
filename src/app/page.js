"use client";

import { useState } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/* ---------- Skeleton (border only) ---------- */
function Skeleton({ className = "" }) {
  return (
    <div
      className={`border border-dashed border-slate-300 rounded-lg animate-pulse ${className}`}
    />
  );
}

export default function Page() {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(null);

  /* ---------- Helpers ---------- */
  function showToast(message) {
    setToast(message);
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

  function addFiles(fileList) {
    setFiles((prev) => {
      const existing = new Set(
        prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`)
      );

      const valid = [];

      for (const file of fileList) {
        const error = validateFile(file);
        if (error) {
          showToast(error);
          continue;
        }

        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existing.has(key)) {
          showToast(`${file.name} already added`);
          continue;
        }

        existing.add(key);
        valid.push(file);
      }

      return [...prev, ...valid];
    });
  }

  /* ---------- Drag & Drop ---------- */
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

  /* ---------- Submit (mock upload) ---------- */
  async function submitResumes() {
    if (!files.length) return;

    setLoading(true);
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + 12, 90));
    }, 200);

    try {
      await new Promise((r) => setTimeout(r, 2000));
      showToast("Resumes uploaded successfully");
      setFiles([]);
    } catch {
      showToast("Upload failed");
    } finally {
      clearInterval(timer);
      setProgress(100);
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-100">

      {/* ---------- Sidebar ---------- */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <nav className="mt-6 flex-1 text-sm">
          <a className="flex items-center gap-3 px-6 py-3 bg-[#F29035] text-white rounded-r-full">
            Resume
          </a>
        </nav>
      </aside>

      {/* ---------- Main ---------- */}
      <main className="flex-1">
        <div className="bg-gradient-to-r from-[#0049af] to-[#0066e0] h-36 rounded-bl-[40px] px-10 pt-8 text-white">
          <h2 className="text-2xl font-semibold">Career Agents's</h2>
        </div>

        <div className="px-10 -mt-16 space-y-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ---------- Upload Panel ---------- */}
            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                Upload Resumes
              </h2>

              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition
                    ${
                      dragActive
                        ? "border-[#0049af]"
                        : "border-slate-300 hover:border-[#0049af]"
                    }`}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <p className="text-sm font-medium">
                    Drag & drop resumes
                  </p>
                  <p className="text-xs text-slate-400">
                    or click to browse (PDF, DOC, DOCX)
                  </p>
                </div>
              )}

              {/* File List */}
              <div className="mt-4 space-y-2">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${file.lastModified}`}
                    className="flex justify-between border rounded-lg px-4 py-2 text-sm"
                  >
                    <span className="truncate">
                      {file.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {/* Progress */}
              {loading && (
                <div className="mt-4">
                  <div className="h-2 rounded-full border border-slate-300">
                    <div
                      className="h-full bg-[#0049af] rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Uploading… {progress}%
                  </p>
                </div>
              )}

              <button
                onClick={submitResumes}
                disabled={!files.length || loading}
                className="mt-4 w-full bg-[#0049af] disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium"
              >
                {loading ? "Processing…" : "Submit Resumes"}
              </button>
            </section>

            {/* ---------- Results Panel ---------- */}
            <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                Uploaded Resumes
              </h2>

              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-10 w-2/3" />
                </div>
              ) : files.length ? (
                <ul className="space-y-2 text-sm">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="border rounded-lg px-4 py-2"
                    >
                      {f.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                  Upload resumes
                </div>
              )}
            </section>

          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-lg text-sm">
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
