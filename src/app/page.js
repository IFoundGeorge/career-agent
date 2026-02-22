"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { OctagonXIcon, CircleCheckIcon, FileTextIcon } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf"];

/* ---------- Skeleton ---------- */
function Skeleton({ className = "" }) {
  return <div className={`rounded-lg bg-slate-200 animate-pulse ${className}`} />;
}

export default function Page() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [applications, setApplications] = useState([]);

  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState({ type: "", message: "" });

  /* ---------- Drawer ---------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
   const [drawerMode, setDrawerMode] = useState("view"); 

  /* ---------- Search ---------- */
  const [search, setSearch] = useState("");

  /* ---------- Pagination ---------- */
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredApplications = applications.filter(
    (app) =>
      app.fullName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredApplications.length / ITEMS_PER_PAGE)
  );

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentApplications = filteredApplications.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const recentApplications = applications.slice(0, 3);

  /* ---------- Toast ---------- */
  function showToast(message, type = "error") {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 3000);
  }

  /* ---------- Helpers ---------- */
  function createApplicationFromFile(file) {
    const name = file.name.replace(".pdf", "");

    return {
      _id: crypto.randomUUID(),
      fullName: name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
      createdAt: new Date().toISOString(),
      file,
      pdfUrl: URL.createObjectURL(file),
    };
  }

  /* ---------- File Handling ---------- */
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

      // also guard against resumes already uploaded as applications
      const uploadedNames = new Set(
        applications.map((a) => a.fullName.toLowerCase())
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

        // check against uploaded applications by name (strip extension)
        const nameOnly = file.name.replace(/\.pdf$/i, "").toLowerCase();
        if (uploadedNames.has(nameOnly)) {
          showToast(`${file.name} was already uploaded`);
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
  function submitResumes() {
    if (!files.length) {
      showToast("No file selected");
      return;
    }

    setLoading(true);
    setProgress(0);

    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 8;
      if (fakeProgress >= 95) fakeProgress = 95;
      setProgress(Math.floor(fakeProgress));
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      const existingNames = new Set(applications.map((a) => a.fullName));
      const newApps = [];
      files.forEach((f) => {
        const candidate = createApplicationFromFile(f);
        if (existingNames.has(candidate.fullName)) {
          showToast(`${candidate.fullName} already exists`);
        } else {
          existingNames.add(candidate.fullName);
          newApps.push(candidate);
        }
      });
      setApplications((prev) => [...newApps, ...prev]);
      setCurrentPage(1);

      setFiles([]);
      setLoading(false);
      showToast("Resumes uploaded", "success");

      setTimeout(() => setProgress(0), 500);
    }, 1600);
  }

  /* ---------- Drawer ---------- */
function openViewDrawer(app) {
  setSelectedApp(app);
  setDrawerMode("view");
  setDrawerOpen(true);
}

function openAnalyzeDrawer(app) {
  setSelectedApp(app);
  setDrawerMode("analyze");
  setDrawerOpen(true);
}

function closeDrawer() {
  setDrawerOpen(false);
  setSelectedApp(null);
}


  function analyzeResume(app) {
    showToast(`Analyzing ${app.fullName}`, "success");
  }

  function deleteApplication(id) {
    setApplications((prev) => prev.filter((app) => app._id !== id));

    if (selectedApp?._id === id) {
      closeDrawer();
    }

    showToast("Resume deleted", "success");
  }

  return (
    <div className="min-h-screen flex bg-slate-100 relative overflow-hidden">
{/* Sidebar */}
<aside className="flex flex-col h-screen w-64 bg-white border-r shadow-sm">
  <div className="flex items-center gap-3 px-5 py-4 border-b">
    <img
      src="/Logo/download.png"
      alt="Career Agent Logo"
      className="h-9 w-auto object-contain"
    />
    {/* sign‑out will be added later when auth is available */}
  </div>
  <nav className="mt-6 flex-1 px-2">
    <ul className="space-y-1">
      <li>
        <button
          className="flex w-full items-center px-4 py-2 text-sm font-medium text-slate-700 rounded-md
                     hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150
                     bg-[#F29035] text-white"
        >
          <FileTextIcon className="h-5 w-5 mr-3" />
          Resume
        </button>
      </li>
      {/* future items go here */}
    </ul>
  </nav>
  <div className="px-4 py-4 border-t text-xs text-slate-400">
    v0.1.0
  </div>
</aside>
      {/* Main */}
     <main className="flex-1 relative overflow-x-hidden">
        <div className="bg-gradient-to-r from-[#0049af] to-[#0066e0] h-36 rounded-bl-[40px] px-10 pt-8 text-white">
        <h2 className="text-2xl font-semibold">Career Agent</h2>
        </div>

      <div className="px-10 -mt-16 space-y-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT */}
        <div className="space-y-6">
              {/* Upload Panel */}
          <section className="bg-white rounded-xl shadow-sm p-6">
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
                <p className="text-xs text-slate-400 mt-1">
                   or click to browse
                </p>
                </div>

                {files.map((file, i) => {
                  const key = `${file.name}-${file.size}-${file.lastModified}`;
                  return (
                    <div
                      key={key}
                      className="mt-2 flex justify-between border rounded px-3 py-2 text-sm"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-red-500 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}

                {loading && (
                  <div className="mt-4">
                  <div className="h-2 bg-slate-200 rounded overflow-hidden">
                   <div
                      className="h-full bg-[#0049af]"
                     style={{ width: `${progress}%` }}
                    />
                    </div>
                    <p className="text-xs mt-1 text-slate-500">
                    Processing… {progress}%
                    </p>
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

              {/* Recently Added */}
              <section className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Recently Added</h2>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : recentApplications.length ? (
                  <ul className="space-y-3">
                    {recentApplications.map((app) => (
                      <li
                        key={app._id}
                        className="border rounded-lg px-3 py-2"
                      >
                        <div className="text-sm font-medium truncate">
                          {app.fullName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {app.email}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-6">
                    No resumes yet
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT */}
          <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  Recently Uploaded Resumes
                </h2>

                <input
                  type="text"
                  placeholder="Search resume..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-64 px-3 py-2 text-sm border rounded-lg"
                />
              </div>

              {currentApplications.length ? (
                <>
                  <ul className="space-y-2">
                    {currentApplications.map((app) => (
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
                            onClick={() => openViewDrawer(app)}
                            className="px-3 py-1 text-xs rounded border"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openAnalyzeDrawer(app)}
                            className="px-3 py-1 text-xs rounded bg-[#0049af] text-white"
                          >
                            Analyze AI
                          </button>
                          <button
                            onClick={() => deleteApplication(app._id)}
                            className="px-3 py-1 text-xs rounded bg-red-100 text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Pagination */}
                  <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm">
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.max(p - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="text-slate-500 disabled:opacity-40"
                    >
                      ← Previous
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const page = i + 1;
                        const show =
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1;

                        if (!show) {
                          if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <span
                                key={page}
                                className="px-2 text-slate-400"
                              >
                                …
                              </span>
                            );
                          }
                          return null;
                        }

                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[36px] h-9 px-3 rounded-lg ${
                              page === currentPage
                                ? "bg-[#0049af] text-white"
                                : "hover:bg-slate-100"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min(p + 1, totalPages)
                        )
                      }
                      disabled={currentPage === totalPages}
                      className="text-slate-500 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  No Uploaded Resumes
                </div>
              )}
            </section>
          </div>
        </div>
        {drawerOpen && (
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/40 z-40"
          />
        )}

        {/* Drawer */}
<div
  className={`fixed top-0 right-0 h-full w-full max-w-[900px] bg-white z-50 shadow-xl transform transition-transform duration-300 ${
    drawerOpen ? "translate-x-0" : "translate-x-full"
  }`}
>
  <div className="p-5 border-b flex justify-between items-center">
    <div>
      <h3 className="font-semibold text-lg">
        {drawerMode === "view"
          ? selectedApp?.fullName
          : "AI Resume Analysis"}
      </h3>

      {drawerMode === "view" && (
        <p className="text-xs text-slate-500">
          {selectedApp?.email}
        </p>
      )}
    </div>

    <button onClick={closeDrawer}>✕</button>
  </div>

  {/* Body */}
  <div className="h-[calc(100%-72px)]">
    {drawerMode === "view" ? (
      selectedApp?.pdfUrl ? (
        <iframe
          key={selectedApp?._id}
          src={selectedApp.pdfUrl}
          className="w-full h-full"
          title="Resume Preview"
        />
      ) : (
        <div className="h-full flex items-center justify-center text-slate-400">
          No preview available
        </div>
      )
    ) : (
      <div className="p-6 space-y-4">
        <div className="bg-slate-50 border rounded-lg p-4">
       Currenly in development, stay tuned for updates!
        </div>
      </div>
    )}
  </div>
</div>

        {/* Toast */}
        {toast.message && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center space-x-2 px-4 py-2 rounded-lg shadow-md text-sm transition-transform duration-200 transform-gpu animate-in slide-in-from-right fade-in ${
              toast.type === "error"
                ? "bg-red-50 text-red-700 border-l-4 border-red-500"
                : "bg-green-50 text-green-700 border-l-4 border-green-500"
            }`}
          >
            {toast.type === "error" ? (
              <OctagonXIcon className="h-5 w-5" />
            ) : (
              <CircleCheckIcon className="h-5 w-5" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        )}
      </main>
    </div>
  );
}