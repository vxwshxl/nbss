"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoldButton } from "@/components/ui/hold-button";
import { Swap } from "@/components/ui/swap";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

/**
 * Reusable confirmation dialog for destructive / important actions.
 * `onConfirm` may be a bound server action; it runs inside a transition.
 */
export function ConfirmDialog({
  trigger,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  hold = false,
  successMessage,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Require a press-and-hold rather than a click to confirm. For irreversible
   * actions where a plain "are you sure?" gets answered on reflex. Destructive
   * only — holding to confirm something harmless is just friction.
   */
  hold?: boolean;
  successMessage?: string;
  onConfirm: () => void | Promise<void>;
  // Optional controlled state, e.g. to open from a dropdown menu item.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onConfirm();
        if (successMessage) toast.success(successMessage);
        setOpen(false);
      } catch {
        toast.error("Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          {hold && destructive ? (
            <HoldButton
              className="h-7 px-2.5 text-[0.8rem]"
              disabled={pending}
              onHold={handleConfirm}
              hint={`Hold to ${confirmLabel.toLowerCase()}`}
            >
              <Swap
                pending={pending}
                idle={confirmLabel}
                busy={
                  <>
                    <Loader2 className="animate-spin" />
                    {confirmLabel}
                  </>
                }
              />
            </HoldButton>
          ) : (
            <Button
              size="sm"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={handleConfirm}
            >
              <Swap
                pending={pending}
                idle={confirmLabel}
                busy={
                  <>
                    <Loader2 className="animate-spin" />
                    {confirmLabel}
                  </>
                }
              />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
