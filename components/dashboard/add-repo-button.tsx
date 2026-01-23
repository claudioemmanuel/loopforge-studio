"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddRepoModal } from "@/components/modals/add-repo-modal";

interface AddRepoButtonProps {
  existingRepoGithubIds: number[];
}

export function AddRepoButton({ existingRepoGithubIds }: AddRepoButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setShowModal(false);
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setShowModal(true)}>Add Repository</Button>
      {showModal && (
        <AddRepoModal
          existingRepoGithubIds={new Set(existingRepoGithubIds)}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
