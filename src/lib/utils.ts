import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + " tỷ";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "tr";
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + "k";
  return n.toLocaleString("vi-VN");
}

export function formatFullMoney(n: number): string {
  return n.toLocaleString("vi-VN") + " ₫";
}

export function formatPercent(n: number): string {
  return (n > 0 ? "+" : "") + n + "%";
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("vi-VN");
}
