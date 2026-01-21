"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WelcomeTutorial } from "@/components/welcome-tutorial";

export function WelcomeTutorialWrapper() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    // Check if this is a first login (welcome=true in URL)
    const isWelcome = searchParams.get("welcome") === "true";

    // Check if user has already seen the welcome tutorial
    const hasSeenWelcome = localStorage.getItem("loopforge-welcome-shown") === "true";

    if (isWelcome && !hasSeenWelcome) {
      setShowTutorial(true);
    }
  }, [searchParams]);

  const handleComplete = () => {
    setShowTutorial(false);
    // Remove the welcome param from URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    router.replace(url.pathname + url.search, { scroll: false });
  };

  if (!showTutorial) return null;

  return <WelcomeTutorial onComplete={handleComplete} />;
}
