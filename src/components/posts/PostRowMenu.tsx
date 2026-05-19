// Three-dot menu for a post row: edit, visibility, copy link, delete.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  setPostVisibility, softDeletePost, publishPost, unpublishPost, type MyPostRow,
} from "@/lib/posts-manage.functions";

export function PostRowMenu({ post, onChanged }: { post: MyPostRow; onChanged: () => void }) {
  const navigate = useNavigate();
  const setVis = useServerFn(setPostVisibility);
  const del = useServerFn(softDeletePost);
  const pub = useServerFn(publishPost);
  const unpub = useServerFn(unpublishPost);
  const [confirmDel, setConfirmDel] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "failed"); }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("link copied 🔗");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="p-2 rounded-full hover:bg-surface-elevated">
          <MoreVertical className="w-4 h-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => navigate({ to: "/me/posts/$postId/edit", params: { postId: post.id } })}>
            ✏️ Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/me/posts/$postId", params: { postId: post.id } })}>
            📈 View analytics
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {post.status === "draft" ? (
            <DropdownMenuItem onClick={() => run(() => pub({ data: { postId: post.id } }), "published 🌍")}>
              🚀 Publish
            </DropdownMenuItem>
          ) : (
            <>
              {post.visibility !== "public" && (
                <DropdownMenuItem onClick={() => run(() => setVis({ data: { postId: post.id, visibility: "public" } }), "now public 🌍")}>
                  🌍 Make public
                </DropdownMenuItem>
              )}
              {post.visibility !== "friends" && (
                <DropdownMenuItem onClick={() => run(() => setVis({ data: { postId: post.id, visibility: "friends" } }), "friends only 🫂")}>
                  🫂 Friends only
                </DropdownMenuItem>
              )}
              {post.visibility !== "private" && (
                <DropdownMenuItem onClick={() => run(() => unpub({ data: { postId: post.id } }), "this one's just for you now 🔒")}>
                  🔒 Make private
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuItem onClick={copyLink}>🔗 Copy link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmDel(true)} className="text-red-400 focus:text-red-400">
            🗑️ Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              the receipts will be wiped 🫥 — this can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>nevermind</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => run(() => del({ data: { postId: post.id } }), "gone forever 🫥")}
              className="bg-red-500 hover:bg-red-600"
            >
              yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
