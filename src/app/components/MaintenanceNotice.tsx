"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useMaintenanceStatus } from "../hooks/useMaintenanceStatus";

export function MaintenanceNotice() {
  const { isInMaintenance, shouldShowBanner, config } = useMaintenanceStatus();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!shouldShowBanner || isInMaintenance) return null;

  const formatMaintenanceTime = () => {
    const start = new Date(config.startTime);
    const end = new Date(config.endTime);
    const fmt = (d: Date) => {
      const M = d.getMonth() + 1;
      const D = d.getDate();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${M}月${D}日 ${h}:${m}`;
    };
    return `${fmt(start)} - ${fmt(end)}`;
  };

  return (
    <div className="fixed right-3 bottom-20 sm:bottom-3 z-[60] pointer-events-none">
      {/* Badge */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-lg border border-yellow-300 dark:border-yellow-700 shadow-sm pointer-events-auto"
        aria-expanded={open}
        aria-label="维护预告"
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs sm:text-sm font-medium">维护预告</span>
        <span className="hidden lg:inline text-xs opacity-90">{formatMaintenanceTime()}</span>
      </button>

      {/* Desktop/Tablet Popover */}
      {open && (
        <div className="hidden sm:block fixed right-3 bottom-14 w-[22rem] max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden pointer-events-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-semibold">维护预告</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
            <div className="mb-2 opacity-80">{formatMaintenanceTime()}</div>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: config.message }}
            />
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      {open && (
        <div className="sm:hidden pointer-events-auto">
          <div
            className="fixed inset-0 bg-black/40 z-[59]"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-2xl shadow-2xl z-[60]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">维护预告</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {formatMaintenanceTime()}
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: config.message }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
