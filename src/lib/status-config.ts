export const statusLabels: Record<string, string> = {
  want: "רוצה",
  maybe: "אולי",
  rejected: "לא מתאים",
}

export const statusColors: Record<string, string> = {
  want: "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
  maybe: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  rejected: "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400",
}

export const statusOrder: Record<string, number> = { want: 0, maybe: 1, rejected: 2 }
