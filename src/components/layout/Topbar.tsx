import { useLocation } from "react-router-dom";

const exactTitles: Record<string, string> = {
  "/dashboard": "Teacher Dashboard",
  "/classes": "Classes",
  "/students": "Students",
  "/question-sets": "Question Sets",
  "/analytics": "Analytics",
  "/leaderboard": "Leaderboard",
  "/settings": "Settings",
};

function titleFromPath(pathname: string): string {
  if (pathname.startsWith("/classes/")) return "Class detail";
  if (pathname.startsWith("/question-sets/")) return "Question set";
  if (pathname.startsWith("/student-results/")) return "Student results";
  return exactTitles[pathname] ?? "CogniMath";
}

export function Topbar() {
  const location = useLocation();
  const title = titleFromPath(location.pathname);

  return (
    <header className="border-b border-slate-200 bg-white px-6 py-4">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    </header>
  );
}
