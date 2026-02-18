"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";


const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf"];

function Skeleton({ className = "" }) {
  return <div className={`rounded-lg bg-slate-200 animate-pulse ${className}`} />;
}

export default function Page() {
  // ---------- State ----------
  const [files, setFiles] = useState([]);
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appsLoading, setAppsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  // Replace the old toast state with this:
  const [toasts, setToasts] = useState([]);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const router = useRouter();


  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false); // NEW
  const [appToDelete, setAppToDelete] = useState(null);           // NEW
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [appToAnalyze, setAppToAnalyze] = useState(null);

  // ---------- Derived Variables ----------
  const ITEMS_PER_PAGE = 10;
  const filteredApplications = applications.filter(
    (app) =>
      app.fullName.toLowerCase().includes(search.toLowerCase()) ||
      app.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentApplications = filteredApplications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const recentApplications = applications.slice(0, 3);

  // ---------- Toast ----------
  // Updated showToast to push to the array
  // ---------- Toast ----------
  function showToast(message, type = "error") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]); // Use setToasts here

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  // ---------- Fetch Applications ----------
  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    setAppsLoading(true);
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Backend returned error");

      const sorted = (data.applications || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setApplications(sorted);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to load applications");
    } finally {
      setAppsLoading(false);
    }
  }

  // ---------- File Handling ----------
  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: invalid file type`;
    if (file.size > MAX_FILE_SIZE) return `${file.name}: exceeds 10MB`;
    return null;
  }

  function addFiles(fileList) {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
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

    // Filter for PDFs only from the dropped files
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );

    if (droppedFiles.length === 0 && e.dataTransfer.files.length > 0) {
      alert("Please drop PDF files only."); // Optional: user feedback
      return;
    }

    addFiles(droppedFiles);
  }

  function handleFileChange(e) {
    if (!e.target.files) return;

    // Filter for PDFs only from the selected files
    const selectedFiles = Array.from(e.target.files).filter(
      (file) => file.type === "application/pdf"
    );

    if (selectedFiles.length === 0 && e.target.files.length > 0) {
      alert("Only PDF files are allowed.");
      e.target.value = "";
      return;
    }

    addFiles(selectedFiles);
    e.target.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- Submit ----------
  async function submitResumes() {
    if (!files.length) {
      showToast("No file selected");
      return;
    }

    setLoading(true);
    setProgress(0);

    let successCount = 0; // Track how many actually uploaded
    let duplicateCount = 0; // Track how many were skipped

    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 7;
      if (fakeProgress >= 90) fakeProgress = 90;
      setProgress(Math.floor(fakeProgress));
    }, 200);

    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("resume", file);

        const res = await fetch("/api/applications", { method: "POST", body: fd });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Upload failed");

        const fileResult = data.results?.[0];

        if (fileResult && !fileResult.success) {
          if (fileResult.isDuplicate) {
            // Specific toast for this file
            showToast(`${file.name} already exists.`, "info");
            duplicateCount++;
            continue;
          } else {
            throw new Error(fileResult.error || "File processing failed");
          }
        }

        // If we got here, it was a real success
        successCount++;
      }

      clearInterval(interval);
      setProgress(100);
      await fetchApplications();
      setFiles([]);

      // --- Smart Final Message ---
      if (successCount > 0) {
        showToast(`Successfully processed ${successCount} resume(s).`, "success");
      } else if (duplicateCount > 0 && successCount === 0) {
        showToast("No new resumes added (all files already exist).", "info");
      }

    } catch (err) {
      clearInterval(interval);
      showToast(err.message || "Upload failed");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }

  function viewResume(app) {
    window.open(`/api/applications/${app._id}/resume`, "_blank");
  }

  // --- Updated analyzeResume Function ---
  async function analyzeResume(app) {
    setAppToAnalyze(app);
    setAnalysisModalOpen(true);
    setAnalysisLoading(true);

    try {
      const res = await fetch(`/api/applications/${app._id}`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        // This maps the MongoDB fields into your state
        setAiResult(data.analysis);
      } else {
        setAiResult(null);
        console.error("Analysis not found in DB");
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setAnalysisLoading(false);
    }
  }

  // Drawer
  function openDrawer(app) {
    if (!app.resumeFileLink) {
      showToast(`No resume available for ${app.fullName}`, "error");
      return;
    }

    setSelectedApp({ ...app, pdfUrl: app.resumeFileLink }); // use resumeFileLink here
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedApp(null);
  }



  async function deleteApplication(id) {
    if (!id) {
      console.error("No application ID provided");
      return;
    }

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      setCurrentApplications(prev => prev.filter(app => app._id !== id));
      showToast("Application deleted","success" );

    } catch (err) {
      console.error(err);
      showToast({ message: err.message, type: "error" });
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-100 relative overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col shadow-sm">
        {/* Logo Section */}
        <div className="h-20 flex items-center justify-center border-b">
          <img
            src="/aretex.png"
            alt="Aretex Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="px-4 py-3 bg-[#F29035] text-white rounded-lg font-medium shadow-sm">
            Resume
          </div>
        </nav>
      </aside>


      {/* Main content */}
      <main className="flex-1 relative flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0049af] to-[#0066e0] h-36 rounded-bl-[40px] px-10 pt-8 text-white">
          <h2 className="text-2xl font-semibold">Career Agent</h2>
        </div>

        {/* Content grid */}
        <div className="px-10 -mt-16 flex-1 overflow-auto">
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
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${dragActive
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

                {files.map((file, i) => (
                  <div
                    key={i}
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
                ))}

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

                {appsLoading ? (
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
                        className="border rounded-lg px-3 py-2 flex justify-between items-center"
                      >
                        <div>
                          <div className="text-sm font-medium truncate">
                            {app.fullName}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {app.email}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {new Date(app.createdAt).toLocaleString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </div>
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
            <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recently Uploaded Resumes</h2>
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

              <div className="flex-1 overflow-auto">
                {appsLoading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : currentApplications.length ? (
                  <ul className="space-y-2">
                    {currentApplications.map((app) => (
                      <li
                        key={app._id}
                        className="border rounded px-4 py-3 flex justify-between items-center transition-shadow duration-300 hover:shadow-md"
                      >
                        <div>
                          <div className="font-medium">{app.fullName}</div>
                          <div className="text-xs text-slate-500">{app.email}</div>
                        </div>

                        <div className="flex gap-2">
                          {/* View Button */}
                          <button
                            onClick={() => openDrawer(app)}
                            className="px-3 py-1 text-xs rounded border transition-transform duration-300 hover:scale-105 hover:bg-slate-100"
                          >
                            View
                          </button>

                          {/* Analyze AI Button */}
                          <button
                            onClick={() => analyzeResume(app)}
                            className="px-3 py-1 text-xs rounded bg-[#0049af] text-white transition-transform duration-300 hover:scale-105 hover:bg-[#003580]"
                          >
                            Analyze AI
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              if (!app?._id) {
                                // NEW
                                showToast("Cannot delete: Missing ID", "error");
                                return;
                              }
                              setAppToDelete(app);      // store the app to delete
                              setDeleteModalOpen(true); // open the confirmation modal
                            }}
                            className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>

                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="h-32 flex items-center justify-center text-slate-400">
                    No Uploaded Resumes
                  </div>
                )}
              </div>


              {/* Pagination */}
              {currentApplications.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
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
                        if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <span key={page} className="px-2 text-slate-400">
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
                          className={`min-w-[36px] h-9 px-3 rounded-lg ${page === currentPage
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
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="text-slate-500 disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>

      </main>

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[900px] bg-white z-50 shadow-xl transform transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div
          className={`p-5 border-b flex justify-between items-center transition-all duration-300 ${drawerOpen ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
            }`}
        >
          <div>
            <h3 className="font-semibold text-lg">{selectedApp?.fullName}</h3>
            <p className="text-xs text-slate-500">{selectedApp?.email}</p>
          </div>
          <button
            onClick={closeDrawer}
            className="text-xl font-bold transition-transform duration-300 hover:scale-110 hover:text-red-500"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          className={`h-[calc(100%-72px)] overflow-auto transition-all duration-300 ${drawerOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
        >
          {selectedApp?.pdfUrl ? (
            <iframe
              src={selectedApp.pdfUrl}
              className="w-full h-full border rounded-lg hover:shadow-lg transition-shadow duration-300"
              title={`Resume Preview - ${selectedApp.fullName}`}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No preview available
            </div>
          )}
        </div>
      </div>



      {/* NEW STACKABLE TOASTS */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-xl shadow-2xl text-sm pointer-events-auto transition-all transform border-l-4 ${t.type === "error" ? "bg-white border-red-500 text-red-700" :
              t.type === "success" ? "bg-white border-green-500 text-green-700" :
                "bg-white border-blue-500 text-blue-700"
              }`}
          >
            <div className="flex items-center gap-2">
              <span>{t.type === "success" ? "✅" : t.type === "error" ? "⚠️" : "ℹ️"}</span>
              <span className="font-bold">{t.message}</span>
            </div>
          </div>
        ))}
      </div>



      {/* AI Analysis Modal */}
      {analysisModalOpen && (
        <>
          <div
            onClick={() => setAnalysisModalOpen(false)}
            className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            {/* Main Card: White background with Blue Glow */}
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-[0_0_50px_-10px_rgba(0,102,224,0.3)] overflow-hidden animate-fade-up max-h-[90vh] flex flex-col">

              {/* Header: Clean White */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0066e0]/10 rounded-xl">
                    <span className="text-[#0066e0] text-xl">✨</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">AI Candidate Report</h3>
                </div>
                <button
                  onClick={() => setAnalysisModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar bg-slate-50/30">
                {analysisLoading ? (
                  <div className="flex flex-col items-center py-20 text-center">
                    <div className="w-12 h-12 border-4 border-[#0066e0]/10 border-t-[#0066e0] rounded-full animate-spin mb-4" />
                    <p className="text-slate-600 font-medium">Generating Report for {appToAnalyze?.fullName}...</p>
                  </div>
                ) : aiResult ? (
                  <div className="space-y-8">

                    {/* Top Row: Score & Status - The "Blue Accent" section */}
                    <div className="bg-[#0066e0] rounded-2xl p-7 flex justify-between items-center shadow-lg shadow-[#0066e0]/20">
                      <div>
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">Match Score</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {aiResult.fitScore > 80 ? "Highly Qualified" : "Candidate Match"}
                        </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={`inline-block px-4 py-1 text-[10px] font-black rounded-full mb-2 shadow-sm ${aiResult.qualificationStatus === "PASS" ? "bg-white text-green-600" : "bg-white text-red-500"
                          }`}>
                          {aiResult.qualificationStatus || "PENDING"}
                        </span>
                        <p className="text-5xl font-black text-white">
                          {aiResult.fitScore || 0}%
                        </p>
                      </div>
                    </div>

                    {/* Summary Section */}
                    <section>
                      <h4 className="text-slate-400 text-[11px] font-black uppercase mb-3 tracking-[0.2em] flex items-center gap-3">
                        Executive Summary
                        <div className="h-[1px] flex-1 bg-slate-100"></div>
                      </h4>
                      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                        <p className="text-slate-700 text-sm leading-relaxed font-medium italic">
                          "{aiResult.summary}"
                        </p>
                      </div>
                    </section>

                    {/* Skills Section */}
                    <section>
                      <h4 className="text-slate-400 text-[11px] font-black uppercase mb-3 tracking-[0.2em] flex items-center gap-3">
                        Core Skills
                        <div className="h-[1px] flex-1 bg-slate-100"></div>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.skills?.map((skill, i) => (
                          <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>

                    {/* Interview Questions Section */}
                    <section>
                      <h4 className="text-slate-400 text-[11px] font-black uppercase mb-3 tracking-[0.2em] flex items-center gap-3">
                        Recommended Questions
                        <div className="h-[1px] flex-1 bg-slate-100"></div>
                      </h4>
                      <ul className="space-y-3">
                        {aiResult.interviewQuestions?.map((q, i) => (
                          <li key={i} className="flex gap-4 text-sm p-4 bg-white rounded-xl border border-slate-100 hover:border-[#0066e0]/30 transition-all shadow-sm">
                            <span className="text-[#0066e0] font-black">0{i + 1}</span>
                            <span className="text-slate-700 font-medium leading-snug">{q}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    {/* Close Button: Solid Blue */}
                    <button
                      onClick={() => setAnalysisModalOpen(false)}
                      className="w-full bg-[#0066e0] hover:bg-[#0052b3] text-white font-bold py-4 rounded-2xl transition-all mt-4 shadow-lg shadow-[#0066e0]/25 active:scale-[0.98]"
                    >
                      Done Reading
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-400">
                    Analysis data unavailable.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <>
          <div
            onClick={() => setDeleteModalOpen(false)}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 shadow-lg animate-fade-up">
              <h3 className="text-lg font-semibold mb-4">Delete Application</h3>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete <strong>{appToDelete?.fullName}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-sm rounded border hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (!appToDelete?._id) return;

                    try {
                      const res = await fetch(`/api/applications/${appToDelete._id}`, { method: "DELETE" });
                      if (!res.ok) throw new Error("Failed to delete application");

                      // Remove deleted app from state
                      setApplications(prev => prev.filter(app => app._id !== appToDelete._id));

                      showToast("Application deleted successfully", "success" );
                      setDeleteModalOpen(false);
                      setAppToDelete(null);
                    } catch (err) {
                      showToast(err.message, "error" );
                    }
                  }}
                  className="px-4 py-2 text-sm rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
