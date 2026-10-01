import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/lib/nexora-data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Nexora" },
      {
        name: "description",
        content: "Update your Nexora profile name and avatar, and review your account details.",
      },
      { property: "og:title", content: "Profile — Nexora" },
      { property: "og:description", content: "Your Nexora account name, avatar and details." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setAvatarUrl(profile.data.avatar_url ?? "");
    }
  }, [profile.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      toast.success("Profile updated");
    } catch {
      toast.error("Couldn't save your profile. Please try again.");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Profile" description="Your account details in Nexora." />

        {profile.isLoading ? (
          <LoadingState rows={2} />
        ) : profile.isError ? (
          <ErrorState onRetry={() => void profile.refetch()} />
        ) : (
          <form onSubmit={submit} className="nexora-panel max-w-xl space-y-5 p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={avatarUrl || undefined} alt="" />
                <AvatarFallback className="bg-surface text-sm">
                  {(fullName || user?.email || "N").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {fullName || "Nexora user"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar image URL</Label>
              <Input
                id="avatar"
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="nexora-label">Email</p>
                <p className="truncate text-sm text-foreground">{user?.email}</p>
              </div>
              <div className="space-y-1">
                <p className="nexora-label">Member since</p>
                <p className="text-sm text-foreground">
                  {profile.data?.created_at
                    ? new Date(profile.data.created_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
