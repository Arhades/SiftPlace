import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUniversityFromEmail(email: string): { name: string; flag: string } {
  const domain = email.toLowerCase().split("@")[1] || "";
  
  if (domain.includes("nus.edu")) {
    return { name: "National University of Singapore (NUS)", flag: "🇸🇬" };
  }
  if (domain.includes("ntu.edu")) {
    return { name: "Nanyang Technological University (NTU)", flag: "🇸🇬" };
  }
  if (domain.includes("chula")) {
    return { name: "Chulalongkorn University", flag: "🇹🇭" };
  }
  if (domain.includes("tu.ac.th") || domain.includes("thammasat")) {
    return { name: "Thammasat University", flag: "🇹🇭" };
  }
  if (domain.includes("lmu.de") || domain.includes("uni-muenchen")) {
    return { name: "LMU Munich", flag: "🇩🇪" };
  }
  if (domain.includes("lse.ac")) {
    return { name: "London School of Economics (LSE)", flag: "🇬🇧" };
  }
  if (domain.includes("sydney.edu")) {
    return { name: "University of Sydney", flag: "🇦🇺" };
  }
  if (domain.includes("mahidol")) {
    return { name: "Mahidol University", flag: "🇹🇭" };
  }
  
  // Parse general domains (e.g., student@bu.edu -> BU University)
  const parts = domain.split(".");
  const domainName = parts[0] === "student" || parts[0] === "mail" ? parts[1] : parts[0];
  const capitalized = (domainName || "other").charAt(0).toUpperCase() + (domainName || "other").slice(1);
  return {
    name: capitalized.length <= 4 ? capitalized.toUpperCase() : capitalized + " Uni",
    flag: "🌐"
  };
}

export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}
