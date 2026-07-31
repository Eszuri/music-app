"use client";

import { motion } from "framer-motion";
import { getAccent } from "../lib/colors";
import { contentMotion } from "../lib/animations";

interface SkeletonProps {
  accentColor?: string;
  className?: string;
  variant?: "text" | "rect" | "circle" | "button" | "cover";
  width?: string;
  height?: string;
  animate?: boolean;
}

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({
  accentColor = "violet",
  className = "",
  variant = "rect",
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const accent = getAccent(accentColor);

  const baseClass = "relative overflow-hidden bg-zinc-800/70";

  const variantClasses = {
    text: "h-3 rounded",
    rect: "rounded",
    circle: "rounded-full",
    button: "h-9 rounded-lg",
    cover: "aspect-square rounded-2xl",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
      style={style}
    >
      {animate && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(0deg, transparent, ${accent.hex400}33, transparent)`,
          }}
          animate={{ y: ["-100%", "200%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </div>
  );
}

/**
 * Skeleton for FolderExplorer file list
 */
export function FolderExplorerSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  const widths = [
    "w-10/12",
    "w-8/12",
    "w-11/12",
    "w-9/12",
    "w-7/12",
    "w-10/12",
    "w-9/12",
    "w-8/12",
  ];
  const accent = getAccent(accentColor);

  return (
    <div
      className="py-1"
    >
      {widths.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3 py-2 border-l-2 border-transparent"
        >
          <span className="shrink-0 w-3 h-3 rounded-sm bg-zinc-800/70" />
          <span
            className={`relative overflow-hidden h-3 rounded ${w} bg-zinc-800/70`}
          >
            <motion.span
              className="absolute inset-x-0 -top-1/2 h-1/2"
              style={{
                background: `linear-gradient(0deg, transparent, ${accent.hex400}33, transparent)`,
              }}
              animate={{ y: ["0%", "300%"] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.08,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for PlayerPanel (album cover + title + artist)
 */
export function PlayerPanelSkeleton({
  accentColor = "violet",
  hideCover = false,
}: {
  accentColor?: string;
  hideCover?: boolean;
}) {
  return (
    <div
      className="w-full flex flex-col items-center gap-2 sm:gap-3.5"
    >
      {!hideCover && (
        <Skeleton
          accentColor={accentColor}
          variant="cover"
          className="w-full max-w-[360px] sm:max-w-[420px] md:max-w-[460px] max-h-[45vh] ring-1 ring-white/5"
        />
      )}
      <div className="text-center w-full px-3 sm:px-4 space-y-2">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-6 w-3/4 mx-auto"
        />
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-4 w-1/2 mx-auto"
        />
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-3 w-2/3 mx-auto"
        />
      </div>
    </div>
  );
}

/**
 * Skeleton for SeekBar
 */
export function SeekBarSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  return (
    <div
      className="w-full"
    >
      <div className="relative w-full h-5 flex items-center">
        <Skeleton
          accentColor={accentColor}
          className="absolute inset-x-0 h-1.5 rounded-full"
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="w-10 h-3"
        />
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="w-10 h-3"
        />
      </div>
    </div>
  );
}

/**
 * Skeleton for PlaybackControls
 */
export function PlaybackControlsSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 sm:gap-3 md:gap-4"
    >
      <Skeleton accentColor={accentColor} variant="button" className="w-9" />
      <Skeleton
        accentColor={accentColor}
        variant="circle"
        className="w-10 h-10"
      />
      <Skeleton
        accentColor={accentColor}
        variant="circle"
        className="w-12 h-12 sm:w-14 sm:h-14"
      />
      <Skeleton
        accentColor={accentColor}
        variant="circle"
        className="w-10 h-10"
      />
      <Skeleton accentColor={accentColor} variant="button" className="w-9" />
    </div>
  );
}

/**
 * Skeleton for VolumeControl
 */
export function VolumeControlSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 w-full justify-center"
    >
      <Skeleton
        accentColor={accentColor}
        variant="circle"
        className="w-7 h-7 shrink-0"
      />
      <Skeleton
        accentColor={accentColor}
        variant="button"
        className="w-5 h-5"
      />
      <Skeleton
        accentColor={accentColor}
        className="flex-1 min-w-[56px] max-w-40 h-1 rounded-full"
      />
      <Skeleton
        accentColor={accentColor}
        variant="button"
        className="w-5 h-5"
      />
      <Skeleton accentColor={accentColor} variant="text" className="w-9 h-3" />
    </div>
  );
}

/**
 * Skeleton for MetadataPanel
 */
export function MetadataPanelSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  return (
    <motion.div
      {...contentMotion}
      className="space-y-4"
    >
      {/* Cover art */}
      <Skeleton
        accentColor={accentColor}
        variant="cover"
        className="w-full max-w-[160px] mx-auto ring-1 ring-white/5"
      />

      {/* Song Info Section */}
      <div className="space-y-3">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-3 w-20"
        />
        <div className="space-y-3 pl-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-2 w-16"
              />
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-3 w-32"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tech Info Section */}
      <div className="space-y-3">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-3 w-24"
        />
        <div className="space-y-3 pl-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-2 w-20"
              />
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-3 w-24"
              />
            </div>
          ))}
        </div>
      </div>

      {/* File Info Section */}
      <div className="space-y-3">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-3 w-20"
        />
        <div className="space-y-3 pl-1">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-2 w-16"
              />
              <Skeleton
                accentColor={accentColor}
                variant="text"
                className="h-3 w-40"
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Header skeleton for initial app load
 */
function HeaderSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <header className="flex items-center px-3 sm:px-5 py-2.5 sm:py-3 border-b border-zinc-800/50 bg-zinc-950/80">
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton
          accentColor={accentColor}
          variant="button"
          className="w-[72px] h-7 rounded-lg"
        />
        <Skeleton
          accentColor={accentColor}
          variant="button"
          className="w-[72px] h-7 rounded-lg"
        />
      </div>
      <div className="flex-1 flex justify-center">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="h-5 w-32"
        />
      </div>
      <Skeleton
        accentColor={accentColor}
        variant="button"
        className="w-[68px] h-5 rounded-full shrink-0"
      />
    </header>
  );
}

/**
 * Status bar skeleton
 */
function StatusBarSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div className="w-full h-6 bg-zinc-950/85 border-t border-white/5 px-3 flex items-center justify-between shrink-0">
      <Skeleton
        accentColor={accentColor}
        variant="text"
        className="w-40 h-2.5"
      />
      <div className="flex items-center gap-3">
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="w-12 h-2.5"
        />
        <span className="h-2.5 w-px bg-zinc-800" />
        <Skeleton
          accentColor={accentColor}
          variant="text"
          className="w-16 h-2.5"
        />
      </div>
    </div>
  );
}

/**
 * Full page skeleton for initial app load — header + content + status bar
 */
export function InitSkeleton({
  accentColor = "violet",
}: {
  accentColor?: string;
}) {
  const accent = getAccent(accentColor);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar skeleton */}
      <div className="w-72 border-r border-zinc-800/50 bg-black/30 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/30">
          <Skeleton
            accentColor={accentColor}
            variant="button"
            className="w-7 h-7"
          />
          <Skeleton
            accentColor={accentColor}
            variant="text"
            className="flex-1 h-3"
          />
          <Skeleton
            accentColor={accentColor}
            variant="button"
            className="w-7 h-7"
          />
        </div>
        <div className="flex-1 p-2">
          <FolderExplorerSkeleton accentColor={accentColor} />
        </div>
      </div>

      {/* Main player area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div
          className="w-full max-w-2xl space-y-6"
        >
          <PlayerPanelSkeleton accentColor={accentColor} />
          <SeekBarSkeleton accentColor={accentColor} />
          <div className="flex justify-center">
            <PlaybackControlsSkeleton accentColor={accentColor} />
          </div>
          <div className="flex justify-center mt-2">
            <VolumeControlSkeleton accentColor={accentColor} />
          </div>
          </div>
      </div>

      {/* Right sidebar skeleton */}
      <div className="w-80 border-l border-zinc-800/50 bg-zinc-950/40 p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800/30">
          <Skeleton
            accentColor={accentColor}
            variant="circle"
            className="w-4 h-4"
          />
          <Skeleton
            accentColor={accentColor}
            variant="text"
            className="w-24 h-3"
          />
        </div>
        <MetadataPanelSkeleton accentColor={accentColor} />
      </div>
    </div>
  );
}

/**
 * Full-page skeleton wrapping header + InitSkeleton + status bar.
 * Reads accent color directly from localStorage so it appears instantly
 * before React state is initialized.
 */
export function FullInitSkeleton() {
  const accentColor =
    typeof window !== "undefined"
      ? window.localStorage.getItem("music-app-accent") || "green"
      : "green";

  return (
    <div
      className="h-full flex flex-col overflow-hidden bg-linear-to-b from-zinc-950 to-black text-zinc-100 select-none font-sans"
    >
      <HeaderSkeleton accentColor={accentColor} />
      <InitSkeleton accentColor={accentColor} />
      <StatusBarSkeleton accentColor={accentColor} />
    </div>
  );
}

/**
 * Skeleton for main player controls when loading metadata
 */
export function PlayerAreaSkeleton({
  accentColor = "violet",
  isFullScreen = false,
}: {
  accentColor?: string;
  isFullScreen?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2.5 sm:gap-4 w-full min-w-0 ${
        isFullScreen
          ? "mt-auto lg:max-w-2xl lg:mb-4 lg:p-4 lg:sm:p-6 bg-black/40 backdrop-blur-xl border-t border-white/10 lg:border lg:rounded-3xl p-4 sm:p-6 lg:shadow-2xl"
          : "my-auto py-1 max-w-2xl"
      }`}
    >
      <PlayerPanelSkeleton accentColor={accentColor} hideCover={isFullScreen} />
      <div className="w-full px-2">
        <SeekBarSkeleton accentColor={accentColor} />
      </div>
      <div className="w-full flex justify-center mt-2">
        <PlaybackControlsSkeleton accentColor={accentColor} />
      </div>
      <div className="w-full flex justify-center mt-1">
        <VolumeControlSkeleton accentColor={accentColor} />
      </div>
    </div>
  );
}
