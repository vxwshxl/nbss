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
  confirmDisabled = false,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title?: string;
  /** A node, not just a string, so a caller can spell out consequences as a list. */
  description?: React.ReactNode;
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
  /**
   * Holds the confirm button closed while the caller is still working out what the
   * action would do. For an irreversible action whose consequences are fetched — how
   * many attendance rows a delete would destroy, say — the button must not be pressable
   * before that answer arrives, or the dialog is asking someone to agree to a blank.
   */
  confirmDisabled?: boolean;
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
      } catch (e) {
        /**
         * The real message, not "something went wrong". The refusals this dialog
         * triggers are things the operator has to act on — "this is the last active
         * administrator" tells them what to do next; a shrug does not.
         *
         * Not rethrown: this runs inside `startTransition`, where an escaping rejection
         * is an unhandled one. `setOpen(false)` sits after the await in the try, so a
         * throwing `onConfirm` already leaves the dialog open on its own — which is the
         * behaviour wanted, so long as `onConfirm` actually returns a promise that
         * rejects rather than swallowing the error itself.
         */
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            // `asChild` is not used, so a caller passing elements would otherwise nest
            // them inside a <p>. Rendered as a div to keep the markup valid.
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">{description}</div>
            </DialogDescription>
          )}
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
              disabled={pending || confirmDisabled}
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
              disabled={pending || confirmDisabled}
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
