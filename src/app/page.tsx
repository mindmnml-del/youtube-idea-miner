"use client";

import { useState } from "react";

export default function Home() {
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValidUrl = (url: string) => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/.test(url);
  };

  async function handlePay() {
    if (!isValidUrl(videoUrl)) {
      setError("Please enter a valid YouTube video URL.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="max-w-xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            YouTube Idea Miner
          </h1>
          <p className="text-gray-400 mt-3 text-lg">
            Extract content ideas from any YouTube video&apos;s comments.
            Questions, requests, and pain points — sorted and ready to use.
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setError("");
            }}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={handlePay}
            disabled={loading || !videoUrl}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-colors"
          >
            {loading ? "Redirecting to checkout..." : "Scan Comments — $0.99"}
          </button>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm text-gray-400">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="font-semibold text-white mb-1">Questions</p>
            <p>Find what your audience is asking</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="font-semibold text-white mb-1">Requests</p>
            <p>Discover content people want</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="font-semibold text-white mb-1">Pain Points</p>
            <p>Spot frustrations to solve</p>
          </div>
        </div>
      </div>
    </main>
  );
}
