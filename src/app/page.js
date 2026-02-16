"use client";

import { useState, useEffect } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf"];

/* ---------- Skeleton ---------- */
function Skeleton({ className = "" }) {
  return <div className={`rounded-lg bg-slate-200 animate-pulse ${className}`} />;
}

export default function Page() {
  const [files, setFiles] = useState([]);
  const [applications, setApplications] = useState([]);

  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appsLoading, setAppsLoading] = useState(true);

  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState({ type: "", message: "" });

  /* ---------- Toast ---------- */
  function showToast(message, type = "error") {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  }

  /* ---------- Fetch Applications ---------- */
  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setAppsLoading(true);
    setShowSkeleton(false);

    const skeletonTimer = setTimeout(() => setShowSkeleton(true), 400);

    try {
      const res = await fetch("/api/applications");
      const data = await res.json();

      if (!res.ok) {
        console.error("Backend error:", data);
        showToast(data?.error || "Failed to load applications");
        return;
      }

      if (data?.success) {
        setApplications(data.applications || []);
      } else {
        showToast("Failed to load applications");
        console.error("Backend response:", data);
      }
    } catch {
      showToast("Failed to load applications");
    } finally {
      setAppsLoading(false);
    }
  }

  /* ---------- File Handling ---------- */
  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: invalid file type`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB`;
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

  /* ---------- Submit ---------- */
  async function submitResumes() {
    if (!files.length) {
      showToast("No file selected");
      return;
    }

    setLoading(true);
    setProgress(0);

    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 6;
      if (fakeProgress >= 90) fakeProgress = 90;
      setProgress(Math.floor(fakeProgress));
    }, 200);

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("resume", file);

        const res = await fetch("/api/applications", {
          method: "POST",
          body: fd,
        });

        const data = await res.json();

        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Upload failed");
        }
      }

      clearInterval(interval);
      setProgress(100);

      await fetchApplications();
      setFiles([]);

      showToast("All resumes processed successfully!", "success");
    } catch (err) {
      clearInterval(interval);
      showToast(err.message || "Upload failed");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }

    // ✅ set states from backend
    setParsedText(data.resumeText);
    setEmail(data.email || "");
    setFullName(data.fullName || "");

    showToast("Resume parsed successfully!");
  } catch (err) {
    console.error("FRONTEND ERROR:", err);
    showToast(err.message || "Failed to parse resume", "error");
  } finally {
    setLoading(false);
  }
}


  function viewResume(app) {
    window.open(`/api/applications/${app._id}/resume`, "_blank");
  }

  function analyzeResume(app) {
    showToast(`Analyzing ${app.fullName}`, "success");
        {/* try to put the api here cyrus  */}
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <nav className="mt-6 flex-1 text-sm">
          <a className="flex items-center gap-3 px-6 py-3 bg-[#F29035] text-white rounded-r-full">
            Resume
          </a>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 relative">
        <div className="bg-gradient-to-r from-[#0049af] to-[#0066e0] h-36 rounded-bl-[40px] px-10 pt-8 text-white">
          <h2 className="text-2xl font-semibold">Career Agent</h2>
        </div>

        <div className="px-10 -mt-16 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Upload Resumes */}
            <section className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Upload Resumes</h2>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                  dragActive
                    ? "border-[#0049af] bg-blue-50"
                    : "border-slate-300 hover:border-[#0049af]"
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <p className="text-sm font-medium">Drag & drop resumes</p>
                <p className="text-xs text-slate-400 mt-1">or click to browse</p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto flex-1">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center border rounded px-4 py-2 text-sm bg-slate-50"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              {loading && (
                <div className="mt-4">
                  <div className="h-2 bg-slate-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#0049af]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs mt-1 text-slate-500">Processing… {progress}%</p>
                </div>
              )}

              <button
                onClick={submitResumes}
                disabled={!files.length || loading}
                className="mt-4 w-full bg-[#0049af] disabled:bg-slate-300 text-white py-2.5 rounded-lg"
              >
                {loading ? "Processing…" : "Submit Resumes"}
              </button>
            </section>

            {/* Recently Uploaded Resumes */}
            <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Recently Uploaded Resumes</h2>

              {appsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : applications.length ? (
                <ul className="space-y-2">
                  {applications.map((app) => (
                    <li
                      key={app._id}
                      className="border rounded px-4 py-3 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{app.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {app.email}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => viewResume(app)}
                          className="px-3 py-1 text-xs rounded border"
                        >
                          View
                        </button>
                        <button
                          onClick={() => analyzeResume(app)}
                          className="px-3 py-1 text-xs rounded bg-[#0049af] text-white"
                        >
                          Analyze AI
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  Upload resumes
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Toast */}
        {toast.message && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm
              ${
                toast.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-green-50 text-green-700 border border-green-200"
              }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast({ message: "", type: "" })}
              className="ml-2 text-xs opacity-60"
            >
              ✕
            </button>
          </div>
        )}
      </main>
    </div>
  );
}