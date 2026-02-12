"use client";

import { useState, useEffect } from "react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "application/pdf",
];

export default function Page() {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);


  // ✅ FETCH FROM MONGODB WHEN PAGE LOADS
  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    try {
      setAppsLoading(true);
      const res = await fetch("/api/applications");
      const data = await res.json();

      if (data.success) {
        setApplications(data.applications);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setAppsLoading(false);
    }
  }

  function ResumeSkeleton() {
    return (
      <div className="border rounded-lg px-4 py-3 space-y-2 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-3 bg-slate-200 rounded w-1/4" />
      </div>
    );
  }



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
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("resume", files[i]);

        const res = await fetch("/api/applications", {
          method: "POST",
          body: fd,
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Upload failed");
        }
      }

      clearInterval(interval);
      setProgress(100);

      // ✅ REFRESH FROM DATABASE AFTER UPLOAD
      await fetchApplications();

      setTimeout(() => {
        showToast("All resumes processed successfully!");
        setFiles([]);
        setLoading(false);
        setProgress(0);
      }, 500);

    } catch (err) {
      clearInterval(interval);
      console.error("Upload error:", err);
      showToast(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-64 bg-white border-r flex flex-col">
        <nav className="mt-6 flex-1 text-sm">
          <a className="flex items-center gap-3 px-6 py-3 bg-[#F29035] text-white rounded-r-full">
            Resume
          </a>
        </nav>
      </aside>

      <main className="flex-1">
        <div className="bg-gradient-to-r from-[#0049af] to-[#0066e0] h-36 rounded-bl-[40px] px-10 pt-8 text-white">
          <h2 className="text-2xl font-semibold">Career Agent</h2>
        </div>

        <div className="px-10 -mt-16 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Upload Panel */}
            <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                Upload Resumes
              </h2>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition
      ${dragActive
                    ? "border-[#0049af]"
                    : "border-slate-300 hover:border-[#0049af]"}
    `}
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
                  or click to browse
                </p>
              </div>

              {/* ✅ SELECTED FILES PREVIEW (THIS WAS MISSING) */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center justify-between border rounded-lg px-4 py-2 text-sm bg-slate-50"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 text-xs hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                    Processing… {progress}%
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

            {/* Recent Applications */}
            <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">
                Recently Uploaded Resumes
              </h2>

              {appsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <ResumeSkeleton key={i} />
                  ))}
                </div>
              ) : applications.length ? (
                <ul className="space-y-3 text-sm">
                  {applications.map((app) => (
                    <li
                      key={app._id}
                      className="border rounded-lg px-4 py-3"
                    >
                      <div className="font-medium">
                        {app.fullName || "No Name"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {app.email || "No Email"}
                      </div>
                      <div className="text-xs mt-1">
                        Status: {app.status || "Processing"}
                      </div>
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
