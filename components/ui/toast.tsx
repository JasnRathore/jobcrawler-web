"use client";

import { Toast } from "@base-ui/react/toast";
import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";

export const toast = Toast.createToastManager();

export function Toaster() {
  return (
    <Toast.Provider toastManager={toast} limit={3} timeout={4200}>
      <Toast.Portal>
        <Toast.Viewport
          aria-label="Notifications"
          className="fixed inset-x-4 bottom-4 z-[100] flex max-h-[calc(100dvh-2rem)] flex-col-reverse gap-2 outline-none sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-[min(24rem,calc(100vw-2rem))] sm:flex-col"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((item) => {
    const type = isToastIconType(item.type) ? item.type : "info";
    const Icon = toastIcons[type];
    return (
      <Toast.Root
        key={item.id}
        toast={item}
        swipeDirection={["down", "right"]}
        className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg transition-[opacity,transform] duration-200 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 sm:data-[starting-style]:translate-y-0 sm:data-[starting-style]:translate-x-3 sm:data-[ending-style]:translate-y-0 sm:data-[ending-style]:translate-x-2"
      >
        <Icon
          aria-hidden="true"
          className={`mt-0.5 size-4 shrink-0 ${toastIconStyles[type]}`}
        />
        <Toast.Content className="min-w-0 flex-1">
          <Toast.Title className="text-sm font-semibold leading-5" />
          <Toast.Description className="mt-1 text-xs leading-relaxed text-muted-foreground" />
        </Toast.Content>
        <Toast.Close
          aria-label="Dismiss notification"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Toast.Close>
      </Toast.Root>
    );
  });
}

function isToastIconType(type: string | undefined): type is keyof typeof toastIcons {
  return type !== undefined && Object.hasOwn(toastIcons, type);
}

const toastIcons = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  loading: LoaderCircle,
};

const toastIconStyles: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-primary",
  loading: "animate-spin text-muted-foreground",
};
