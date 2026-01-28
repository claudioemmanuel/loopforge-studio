"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { useSettings } from "../settings-context";

export default function AccountPage() {
  const { user } = useSettings();

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4" />
          <h3 className="font-serif font-semibold tracking-tight">Profile</h3>
        </div>
        <div className="flex items-center gap-4">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || ""}
              width={64}
              height={64}
              className="rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {user.name?.[0] || "U"}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
