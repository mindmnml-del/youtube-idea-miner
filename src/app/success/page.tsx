"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface ContentIdea {
  idea: string;
  source: string;
  likes: number;
  replies: number;
  category: string;
}

type SortKey = keyof ContentIdea;

function ScanResults() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id");
  const videoUrl = params.get("video_url");

  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("likes");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!sessionId || !videoUrl) {
      setError("Missing payment session or video URL.");
      setLoading(false);
      return;
    }

    async function runScan() {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, videoUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Scan failed");
        }

        const data = await res.json();
        setIdeas(data.ideas);
        setTotalComments(data.totalComments);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        setLoading(false);
      }
    }

    runScan();
  }, [sessionId, videoUrl]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sorted = [...ideas].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    return sortAsc
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg text-gray-300">
          Scanning YouTube comments... This may take 1-2 minutes.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Content Ideas Extracted</h1>
          <p className="text-gray-400 mt-1">
            Found {ideas.length} ideas from {totalComments} comments
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
        >
          Scan Another Video
        </button>
      </div>

      {ideas.length === 0 ? (
        <p className="text-gray-400">
          No actionable content ideas found in this video&apos;s comments.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("category")}
                >
                  Category{arrow("category")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("idea")}
                >
                  Idea{arrow("idea")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort("source")}
                >
                  Source{arrow("source")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white text-right"
                  onClick={() => handleSort("likes")}
                >
                  Likes{arrow("likes")}
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-white text-right"
                  onClick={() => handleSort("replies")}
                >
                  Replies{arrow("replies")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sorted.map((idea, i) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        idea.category === "Content Request"
                          ? "bg-green-900 text-green-300"
                          : idea.category === "Question"
                            ? "bg-blue-900 text-blue-300"
                            : "bg-red-900 text-red-300"
                      }`}
                    >
                      {idea.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-md">{idea.idea}</td>
                  <td className="px-4 py-3 text-gray-400">{idea.source}</td>
                  <td className="px-4 py-3 text-right">{idea.likes}</td>
                  <td className="px-4 py-3 text-right">{idea.replies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ScanResults />
    </Suspense>
  );
}
