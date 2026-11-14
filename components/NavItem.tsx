"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { View } from "./types";

export function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: View | "Help center";
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs transition duration-150 ${
        active
          ? "bg-black text-white font-medium shadow-sm"
          : "text-zinc-600 hover:text-black hover:bg-zinc-100/80 font-normal"
      }`}
    >
      <Icon size={16} strokeWidth={active ? 2 : 1.75} />
      <span>{label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
}
