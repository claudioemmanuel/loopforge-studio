"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddRepoModal } from "@/components/modals/add-repo-modal";
import { useTranslations } from "next-intl";

interface AddRepoButtonProps {
  existingRepoGithubIds: number[];
}

export function AddRepoButton({ existingRepoGithubIds }: AddRepoButtonProps) {
  const t = useTranslations("repositories");
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setShowModal(false);
    router.refresh();
  };

  return (
    <>
      <Button onClick={() => setShowModal(true)}>{t("add")}</Button>
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
